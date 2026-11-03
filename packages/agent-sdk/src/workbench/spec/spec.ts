import type {
    WorkbenchBlockDefinition,
    WorkbenchDataShape,
    WorkbenchPropDefinition,
    WorkbenchSpecBinding,
    WorkbenchSpecNode,
    WorkbenchSpecProblem,
    WorkbenchSpecRegistry,
    WorkbenchSpecText,
    WorkbenchSpecValue,
    WorkbenchStoredSpec,
} from "./spec.types"

/** The deepest a block tree may nest: a screen deeper than this is a composition mistake, and it bounds the walk. */
export const SPEC_MAX_DEPTH: number = 8

/** The variable a read writes for the installation of the route. */
const INSTALLATION_VARIABLE = "$installationId"

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Whether a value is a spec text: a key, or both product languages. */
export const isSpecText = (value: unknown): value is WorkbenchSpecText =>
    isRecord(value) && (typeof value.key === "string" || (typeof value.vi === "string" && typeof value.en === "string"))

/** Whether a literal fits the declared type of a prop. */
const fitsProp = (definition: WorkbenchPropDefinition, value: WorkbenchSpecValue): boolean => {
    switch (definition.type) {
        case "string":
            return typeof value === "string" && (definition.oneOf === undefined || definition.oneOf.includes(value))
        case "number":
            return typeof value === "number" && Number.isFinite(value)
        case "boolean":
            return typeof value === "boolean"
        case "text":
            return isSpecText(value)
        case "list":
            return Array.isArray(value)
    }
}

/** The problems of a node's props against its block. */
const propProblems = (
    block: WorkbenchBlockDefinition,
    props: Readonly<Record<string, WorkbenchSpecValue>>,
    at: string,
): ReadonlyArray<WorkbenchSpecProblem> => {
    const problems: Array<WorkbenchSpecProblem> = []
    for (const [name, value] of Object.entries(props)) {
        const definition = block.props[name]
        if (definition === undefined) problems.push({ code: "SPEC_PROP_UNKNOWN", at: `${at}.${name}` })
        else if (!fitsProp(definition, value)) problems.push({ code: "SPEC_PROP_TYPE", at: `${at}.${name}` })
    }
    for (const [name, definition] of Object.entries(block.props))
        if (definition.required && props[name] === undefined)
            problems.push({ code: "SPEC_PROP_MISSING", at: `${at}.${name}` })
    return problems
}

/** The shape a read binding yields: the read's own, or the shape the read gives the path; undefined for a path it does not expose. */
const shapeOf = (
    read: WorkbenchSpecRegistry["reads"][string],
    path: string | undefined,
): WorkbenchDataShape | undefined => (path === undefined ? read.shape : read.paths[path])

/** The problem of one binding against its slot and the registry, or null when it is sound. */
const bindingProblem = (
    registry: WorkbenchSpecRegistry,
    module: string,
    slot: WorkbenchBlockDefinition["slots"][string],
    binding: WorkbenchSpecBinding,
): WorkbenchSpecProblem["code"] | null => {
    if ("action" in binding) {
        if (slot.kind !== "action") return "SPEC_BINDING_KIND"
        const action = registry.actions[binding.action]
        if (action === undefined) return "SPEC_BINDING_UNKNOWN"
        return action.module === module ? null : "SPEC_BINDING_FOREIGN"
    }
    if (slot.kind !== "read") return "SPEC_BINDING_KIND"
    const read = registry.reads[binding.read]
    if (read === undefined) return "SPEC_BINDING_UNKNOWN"
    if (read.module !== module) return "SPEC_BINDING_FOREIGN"
    const shape = shapeOf(read, binding.path)
    if (shape === undefined) return "SPEC_BINDING_UNKNOWN"
    return slot.shape === undefined || slot.shape === shape ? null : "SPEC_BINDING_SHAPE"
}

/** The problems of a node's bindings against its block's slots. */
const slotProblems = (
    registry: WorkbenchSpecRegistry,
    module: string,
    block: WorkbenchBlockDefinition,
    bind: Readonly<Record<string, WorkbenchSpecBinding>>,
    at: string,
): ReadonlyArray<WorkbenchSpecProblem> => {
    const problems: Array<WorkbenchSpecProblem> = []
    for (const [name, binding] of Object.entries(bind)) {
        const slot = block.slots[name]
        if (slot === undefined) {
            problems.push({ code: "SPEC_SLOT_UNKNOWN", at: `${at}.${name}` })
            continue
        }
        const code = bindingProblem(registry, module, slot, binding)
        if (code !== null) problems.push({ code, at: `${at}.${name}` })
    }
    for (const [name, slot] of Object.entries(block.slots))
        if (slot.required && bind[name] === undefined) problems.push({ code: "SPEC_SLOT_MISSING", at: `${at}.${name}` })
    return problems
}

/** What a walk of one view carries. */
interface WalkContext {
    readonly registry: WorkbenchSpecRegistry
    readonly module: string
    readonly view: string
    readonly ids: Set<string>
    readonly problems: Array<WorkbenchSpecProblem>
}

/** Walks one node and its children, depth first, collecting problems. */
const walk = (context: WalkContext, node: WorkbenchSpecNode, depth: number): void => {
    const at = `${context.view}/${node.id}`
    if (depth > SPEC_MAX_DEPTH) {
        context.problems.push({ code: "SPEC_TOO_DEEP", at })
        return
    }
    if (context.ids.has(node.id)) context.problems.push({ code: "SPEC_NODE_DUPLICATE", at })
    context.ids.add(node.id)
    const block = context.registry.blocks[node.block]
    if (block === undefined) {
        context.problems.push({ code: "SPEC_BLOCK_UNKNOWN", at })
        return
    }
    context.problems.push(...propProblems(block, node.props ?? {}, at))
    context.problems.push(...slotProblems(context.registry, context.module, block, node.bind ?? {}, at))
    const children = node.children ?? []
    if (children.length > 0 && !block.children) context.problems.push({ code: "SPEC_CHILDREN_REFUSED", at })
    for (const child of children) walk(context, child, depth + 1)
}

/**
 * What is wrong with a spec document against the build-time registry, empty when the host may store, publish and draw it: the known
 * schema, at least one view, unique view and node ids, a bounded depth, every block registered, every prop declared and of its type,
 * every required prop and slot given, and every binding a read or action of the spec's own module, of the slot's kind and shape.
 */
export const specProblems = (
    document: WorkbenchStoredSpec,
    registry: WorkbenchSpecRegistry,
): ReadonlyArray<WorkbenchSpecProblem> => {
    const problems: Array<WorkbenchSpecProblem> = []
    if (document.schema !== "nivo/workbench-spec@1") return [{ code: "SPEC_SCHEMA_UNKNOWN", at: "schema" }]
    if (document.views.length === 0) problems.push({ code: "SPEC_NO_VIEW", at: "views" })
    const views = new Set<string>()
    for (const view of document.views) {
        if (views.has(view.id)) problems.push({ code: "SPEC_VIEW_DUPLICATE", at: view.id })
        views.add(view.id)
        walk({ registry, module: document.module, view: view.id, ids: new Set(), problems }, view.root, 1)
    }
    return problems
}

/** The value at a dotted path of a value; undefined when a step is missing. The empty or absent path is the value itself. */
export const valueAt = (value: unknown, path: string | undefined): unknown => {
    if (path === undefined || path === "") return value
    let current: unknown = value
    for (const name of path.split(".")) {
        if (!isRecord(current)) return undefined
        current = current[name]
    }
    return current
}

/** A value as the text a block draws: strings and finite numbers as they are, anything else empty. */
export const textOf = (value: unknown): string => {
    if (typeof value === "string") return value
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    return ""
}

/** A spec text in the viewer's words: a key through the module's translator, owner-written words in the viewer's language. */
export const wordsOf = (text: WorkbenchSpecText, translate: (key: string) => string, locale: "vi" | "en"): string =>
    "key" in text ? translate(text.key) : text[locale]

/** The variables of a read with the route's installation put in. */
export const variablesOf = (
    variables: Readonly<Record<string, string | number | boolean | null>>,
    installationId: string,
): Readonly<Record<string, string | number | boolean | null>> =>
    Object.fromEntries(
        Object.entries(variables).map(([name, value]) => [
            name,
            value === INSTALLATION_VARIABLE ? installationId : value,
        ]),
    )

/** A registry from its parts; two definitions under one name are refused, so a module can never shadow an SDK block. */
export const specRegistryOf = (parts: {
    readonly blocks: ReadonlyArray<WorkbenchBlockDefinition>
    readonly reads: ReadonlyArray<WorkbenchSpecRegistry["reads"][string]>
    readonly actions: ReadonlyArray<WorkbenchSpecRegistry["actions"][string]>
}): WorkbenchSpecRegistry => {
    const keyed = <T extends { readonly name: string }>(kind: string, items: ReadonlyArray<T>): Record<string, T> => {
        const out: Record<string, T> = {}
        for (const item of items) {
            if (out[item.name] !== undefined) throw new Error(`SPEC_REGISTRY_DUPLICATE: ${kind} ${item.name}`)
            out[item.name] = item
        }
        return out
    }
    return {
        blocks: keyed("block", parts.blocks),
        reads: keyed("read", parts.reads),
        actions: keyed("action", parts.actions),
    }
}
