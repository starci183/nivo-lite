import type { ActionDefinition, BlockDefinition, BlockReadSlot, BlockSlot, ReadDefinition } from "../block/block.types"
import type { DataShape } from "../schema/schema.types"
import { paramProblems } from "./spec-param"
import { paramNameOf } from "./spec-value"
import type {
    SpecBinding,
    SpecNode,
    SpecParam,
    SpecProblem,
    SpecProblemCode,
    SpecReadBinding,
    StoredSpec,
} from "./spec.types"

/** The deepest a block tree may nest: a screen deeper than this is a composition mistake, and it bounds the walk. */
export const SPEC_MAX_DEPTH: number = 8

/** What a spec may bind, when the caller knows it. A kind left out is not judged: its bindings are not looked up. */
export interface SpecBindings {
    /** The reads a read slot may be bound to. */
    readonly reads?: ReadonlyArray<ReadDefinition>
    /** The actions an action slot may be bound to. */
    readonly actions?: ReadonlyArray<ActionDefinition>
    /** The permissions the module declares; a `when.permission` outside them is refused. */
    readonly permissions?: ReadonlyArray<string>
}

/** What a walk of one scope (head, foot or a view) carries. */
interface WalkContext {
    readonly blocks: ReadonlyMap<string, BlockDefinition>
    readonly bindings: SpecBindings
    readonly params: Readonly<Record<string, SpecParam>>
    readonly scope: string
    readonly ids: Set<string>
    readonly problems: Array<SpecProblem>
}

/** The installed blocks by id. */
export const blockIndex = (blocks: ReadonlyArray<BlockDefinition>): ReadonlyMap<string, BlockDefinition> =>
    new Map(blocks.map((block) => [block.id, block]))

/** A zod issue path as `.name` and `[index]` steps. */
const pathOf = (path: ReadonlyArray<PropertyKey>): string =>
    path.map((step) => (typeof step === "number" ? `[${step}]` : `.${String(step)}`)).join("")

/** The problems of a node's literal props against its block's zod schema, one per issue. */
const propProblems = (block: BlockDefinition, node: SpecNode, at: string): ReadonlyArray<SpecProblem> => {
    const parsed = block.props.safeParse(node.props ?? {})
    if (parsed.success) return []
    return parsed.error.issues.flatMap((issue): ReadonlyArray<SpecProblem> => {
        const base = `${at}${pathOf(issue.path)}`
        if (issue.code !== "unrecognized_keys") return [{ code: "SPEC_PROP_INVALID", at: base }]
        return issue.keys.map((key): SpecProblem => ({ code: "SPEC_PROP_INVALID", at: `${base}.${key}` }))
    })
}

/** The shape a read binding yields: the read's own, or the shape the read gives the path; undefined for a path it does not expose. */
const shapeOf = (read: ReadDefinition, path: string | undefined): DataShape | undefined =>
    path === undefined ? read.shape : read.paths[path]

/** The problem of a read binding against its slot, or null when it is sound. */
const readBindingProblem = (
    bindings: SpecBindings,
    slot: BlockReadSlot,
    binding: SpecReadBinding,
): SpecProblemCode | null => {
    if (bindings.reads === undefined) return null
    const read = bindings.reads.find((candidate) => candidate.id === binding.read)
    if (read === undefined) return "SPEC_BINDING_UNKNOWN"
    const shape = shapeOf(read, binding.path)
    if (shape === undefined) return "SPEC_BINDING_UNKNOWN"
    if (shape !== slot.shape) return "SPEC_BINDING_SHAPE"
    return slot.dataKind === undefined || slot.dataKind === read.dataKind ? null : "SPEC_BINDING_DATA_KIND"
}

/** The problem of one binding against its slot and what the spec may bind, or null when it is sound. */
const bindingProblem = (bindings: SpecBindings, slot: BlockSlot, binding: SpecBinding): SpecProblemCode | null => {
    if ("action" in binding) {
        if (slot.kind !== "action") return "SPEC_BINDING_KIND"
        const known = bindings.actions?.some((candidate) => candidate.id === binding.action)
        return known === false ? "SPEC_BINDING_UNKNOWN" : null
    }
    return slot.kind === "read" ? readBindingProblem(bindings, slot, binding) : "SPEC_BINDING_KIND"
}

/** The problems of the variables of a read binding: a variable the read does not declare, a `$name` that names no param. */
const variableProblems = (
    bindings: SpecBindings,
    params: Readonly<Record<string, SpecParam>>,
    binding: SpecReadBinding,
    at: string,
): ReadonlyArray<SpecProblem> => {
    const declared = bindings.reads?.find((candidate) => candidate.id === binding.read)?.variables.shape
    const problems: Array<SpecProblem> = []
    for (const [name, value] of Object.entries(binding.variables ?? {})) {
        if (declared !== undefined && !Object.keys(declared).includes(name))
            problems.push({ code: "SPEC_VAR_UNKNOWN", at: `${at}.${name}` })
        const param = paramNameOf(value)
        if (param !== null && !Object.keys(params).includes(param))
            problems.push({ code: "SPEC_PARAM_UNKNOWN", at: `${at}.${name}` })
    }
    return problems
}

/** The problems of a node's props that name a spec param (the block's `params`): a name the spec does not declare. */
const paramPropProblems = (
    block: BlockDefinition,
    node: SpecNode,
    params: Readonly<Record<string, SpecParam>>,
    at: string,
): ReadonlyArray<SpecProblem> =>
    (block.params ?? []).flatMap((name): ReadonlyArray<SpecProblem> => {
        const value = node.props?.[name]
        return typeof value === "string" && !Object.keys(params).includes(value)
            ? [{ code: "SPEC_PARAM_UNKNOWN", at: `${at}.${name}` }]
            : []
    })

/** The problems of a node's bindings against its block's slots. */
const slotProblems = (
    bindings: SpecBindings,
    params: Readonly<Record<string, SpecParam>>,
    block: BlockDefinition,
    bind: Readonly<Record<string, SpecBinding>>,
    at: string,
): ReadonlyArray<SpecProblem> => {
    const problems: Array<SpecProblem> = []
    for (const [name, binding] of Object.entries(bind)) {
        const slot = block.slots[name]
        if (slot === undefined) {
            problems.push({ code: "SPEC_SLOT_UNKNOWN", at: `${at}.${name}` })
            continue
        }
        const code = bindingProblem(bindings, slot, binding)
        if (code !== null) problems.push({ code, at: `${at}.${name}` })
        if ("read" in binding) problems.push(...variableProblems(bindings, params, binding, `${at}.${name}`))
    }
    for (const [name, slot] of Object.entries(block.slots))
        if (slot.required && bind[name] === undefined) problems.push({ code: "SPEC_SLOT_MISSING", at: `${at}.${name}` })
    return problems
}

/** The problems of a node's children against its block's `children` rule. */
const childrenProblems = (
    block: BlockDefinition,
    children: ReadonlyArray<SpecNode>,
    scope: string,
    at: string,
): ReadonlyArray<SpecProblem> => {
    if (children.length === 0) return []
    const rule = block.children
    if (rule === false || (rule.max !== undefined && children.length > rule.max))
        return [{ code: "SPEC_CHILDREN_REFUSED", at }]
    const accepts = rule.accepts
    if (accepts === undefined) return []
    return children
        .filter((child) => !accepts.includes(child.block))
        .map((child): SpecProblem => ({ code: "SPEC_CHILD_NOT_ACCEPTED", at: `${scope}/${child.id}` }))
}

/** Walks one node and its children, depth first, collecting problems. */
const walk = (context: WalkContext, node: SpecNode, depth: number): void => {
    const at = `${context.scope}/${node.id}`
    if (depth > SPEC_MAX_DEPTH) {
        context.problems.push({ code: "SPEC_TOO_DEEP", at })
        return
    }
    if (context.ids.has(node.id)) context.problems.push({ code: "SPEC_NODE_DUPLICATE", at })
    context.ids.add(node.id)
    const permission = node.when?.permission
    if (permission !== undefined && context.bindings.permissions?.includes(permission) === false)
        context.problems.push({ code: "SPEC_WHEN_UNKNOWN", at })
    const block = context.blocks.get(node.block)
    if (block === undefined) {
        context.problems.push({ code: "SPEC_BLOCK_UNKNOWN", at })
        return
    }
    const children = node.children ?? []
    context.problems.push(
        ...propProblems(block, node, at),
        ...paramPropProblems(block, node, context.params, at),
        ...slotProblems(context.bindings, context.params, block, node.bind ?? {}, at),
        ...childrenProblems(block, children, context.scope, at),
    )
    for (const child of children) walk(context, child, depth + 1)
}

/**
 * What is wrong with a spec document against the installed blocks, empty when the host may store, publish and draw it: the known
 * schema, at least one view, unique view and node ids, a bounded depth, every block installed, props valid against the block zod
 * schema, every required slot bound, bindings of the slot kind, shape and data kind, variables the read declares and params the spec
 * declares, sound params, and children the block accepts.
 */
export const specProblems = (
    spec: StoredSpec,
    blocks: ReadonlyArray<BlockDefinition>,
    bindings: SpecBindings = {},
): ReadonlyArray<SpecProblem> => {
    if (spec.schema !== "nivo/workbench-spec@1") return [{ code: "SPEC_SCHEMA_UNKNOWN", at: "schema" }]
    const blocksById = blockIndex(blocks)
    const params = spec.params ?? {}
    const problems: Array<SpecProblem> = [...paramProblems(params, bindings.reads)]
    if (spec.views.length === 0) problems.push({ code: "SPEC_NO_VIEW", at: "views" })
    const shared = new Set<string>()
    const regions: ReadonlyArray<readonly [string, ReadonlyArray<SpecNode>]> = [
        ["head", spec.head ?? []],
        ["foot", spec.foot ?? []],
    ]
    for (const [scope, nodes] of regions)
        for (const node of nodes) walk({ blocks: blocksById, bindings, params, scope, ids: shared, problems }, node, 1)
    const views = new Set<string>()
    for (const view of spec.views) {
        if (views.has(view.id)) problems.push({ code: "SPEC_VIEW_DUPLICATE", at: view.id })
        views.add(view.id)
        walk({ blocks: blocksById, bindings, params, scope: view.id, ids: new Set(shared), problems }, view.root, 1)
    }
    return problems
}
