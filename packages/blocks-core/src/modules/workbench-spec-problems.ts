import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { type ModuleDeclaration, seedSpecProblems } from "@nivo-lite/agent-sdk/module"
import type { ApiVerb } from "@nivo-lite/agent-sdk/names"
import type { ToolDefinition } from "@nivo-lite/agent-sdk/node"
import type { SpecNode, SpecProblemCode, SpecReadBinding, StoredSpec } from "@nivo-lite/agent-sdk/spec"
import { z } from "zod"
import { DATA_VIEW_PREFIX, dataSetViewOf } from "../blocks/data-sets.block"

/*
 * THE WORKBENCH RULE, for every agent: a workbench is that agent's work desk, the visual view of what the agent does, and raw records
 * open on their own data page. What `seedSpecProblems` (the SDK) judges, plus:
 * - the provider-read binding `{ "read": "<provider>:<read>", "variables": { ... } }`, judged against the reads the provider offers
 *   (shape against the slot, variables against the read's inputs), the SDK knowing only module reads;
 * - `SPEC_DESK_MISSING`: the first view of an agent module's workbench spec is not the desk (its tree holds `core.agent-flows` over
 *   `platform.agent-flows` and `core.list-card` over `platform.agent-runs`);
 * - `SPEC_PROVIDER_TABLE_IN_DESK`: a list slot bound to a provider read outside a data page view (`data-<set>`);
 * - `SPEC_DATA_PAGE_TAB`: a data page view that draws a tab (it opens from its own route, never as a tab of the desk);
 * - `SPEC_DATA_PAGE_MISSING`: a data set of `core.data-sets` whose page (`data-<set>`) the spec does not hold.
 * It proves the SHAPE (desk first, raw provider tables only on pages); whether the desk tells the agent's work well is the review's.
 */

/** A provider read name: `<provider>:<read>`, the same pattern the person-read door dispatches by; a module read holds no colon. */
export const PROVIDER_READ_NAME: RegExp = /^([a-z][a-z0-9_-]{1,30}):([a-z][a-z0-9.-]{1,100})$/u

/** The provider and the read a binding names, or null for a module read. */
export const providerReadOf = (name: string): { readonly provider: string; readonly read: string } | null => {
    const match = PROVIDER_READ_NAME.exec(name)
    const provider = match?.[1]
    const read = match?.[2]
    return provider === undefined || read === undefined ? null : { provider, read }
}

/** One read a provider offers a screen, as a spec is judged against it. */
export interface ProviderReadFacts {
    /** `<provider>:<read>`. */
    readonly name: string
    /** `list` for a page of rows (the door's `page`), `record` for one record. */
    readonly shape: "list" | "record"
    /** The names of its input members, which a binding's variables must be. */
    readonly inputs: ReadonlyArray<string>
}

/** The codes of the workbench rule, beside the SDK's own. */
export type WorkbenchRuleCode =
    | "SPEC_DESK_MISSING"
    | "SPEC_PROVIDER_TABLE_IN_DESK"
    | "SPEC_DATA_PAGE_TAB"
    | "SPEC_DATA_PAGE_MISSING"

/** Why a seed spec was refused, and where; the SDK's codes and the rule's. */
export interface WorkbenchProblem {
    /** The index of the spec in the module's `specs`. */
    readonly spec: number
    /** The rule broken and where. */
    readonly problem: WorkbenchProblemAt
}

/** The rule a seed spec broke and where. */
type WorkbenchProblemAt = {
    /** The code of the rule broken. */
    readonly code: SpecProblemCode | WorkbenchRuleCode
    /** Where in the spec it was broken. */
    readonly at: string
}

/** The view id of the desk every agent module's workbench spec opens on. */
export const DESK_VIEW_ID = "desk"

/** The read and block that make a view a desk: how the agent works, and what it just did. */
const DESK_MARKS: ReadonlyArray<readonly [string, string]> = [
    ["core.agent-flows", "platform.agent-flows"],
    ["core.list-card", "platform.agent-runs"],
]

/** One read binding of a node, where it is in the spec. */
interface PlacedBinding {
    /** `<scope>/<node id>.<slot>`, as the SDK names the place. */
    readonly at: string
    /** The scope: a view id, `head`, `foot` or `aside`. */
    readonly scope: string
    /** The node. */
    readonly node: SpecNode
    /** The slot name. */
    readonly slot: string
    /** The binding. */
    readonly binding: SpecReadBinding
}

/** Every node of a tree, depth first. */
const nodesOf = (node: SpecNode): ReadonlyArray<SpecNode> => [node, ...(node.children ?? []).flatMap((item) => nodesOf(item))]

/** The scopes of a spec and the nodes each holds. */
const scopesOf = (spec: StoredSpec): ReadonlyArray<readonly [string, ReadonlyArray<SpecNode>]> => [
    ["head", (spec.head ?? []).flatMap((item) => nodesOf(item))],
    ["foot", (spec.foot ?? []).flatMap((item) => nodesOf(item))],
    ["aside", spec.aside === undefined ? [] : nodesOf(spec.aside)],
    ...spec.views.map((view): readonly [string, ReadonlyArray<SpecNode>] => [view.id, nodesOf(view.root)]),
]

/** Every read binding of a spec bound to a provider read. */
const providerBindingsOf = (spec: StoredSpec): ReadonlyArray<PlacedBinding> =>
    scopesOf(spec).flatMap(([scope, nodes]) =>
        nodes.flatMap((node) =>
            Object.entries(node.bind ?? {}).flatMap(([slot, binding]): ReadonlyArray<PlacedBinding> =>
                "read" in binding && providerReadOf(binding.read) !== null
                    ? [{ at: `${scope}/${node.id}.${slot}`, scope, node, slot, binding }]
                    : [],
            ),
        ),
    )

/** Whether a view is a data page. */
const isDataPage = (scope: string): boolean => scope.startsWith(DATA_VIEW_PREFIX)

/** What the SDK refused only because it does not know provider reads: the unknown binding at the place of a provider binding. */
const isProviderUnknown = (code: string, at: string, places: ReadonlySet<string>): boolean =>
    code === "SPEC_BINDING_UNKNOWN" && places.has(at)

/** The problems of one provider binding against the reads offered and the slot it fills. */
const providerBindingProblems = (
    placed: PlacedBinding,
    blocks: ReadonlyMap<string, BlockDefinition>,
    offered: ReadonlyMap<string, ProviderReadFacts>,
): ReadonlyArray<{ readonly code: SpecProblemCode | WorkbenchRuleCode; readonly at: string }> => {
    const read = offered.get(placed.binding.read)
    const slot = blocks.get(placed.node.block)?.slots[placed.slot]
    const problems: Array<{ readonly code: SpecProblemCode | WorkbenchRuleCode; readonly at: string }> = []
    if (read === undefined || placed.binding.path !== undefined) problems.push({ code: "SPEC_BINDING_UNKNOWN", at: placed.at })
    else if (slot?.kind === "read" && slot.shape !== read.shape) problems.push({ code: "SPEC_BINDING_SHAPE", at: placed.at })
    for (const name of Object.keys(placed.binding.variables ?? {}))
        if (read !== undefined && !read.inputs.includes(name)) problems.push({ code: "SPEC_VAR_UNKNOWN", at: `${placed.at}.${name}` })
    if (slot?.kind === "read" && slot.shape === "list" && !isDataPage(placed.scope))
        problems.push({ code: "SPEC_PROVIDER_TABLE_IN_DESK", at: placed.at })
    return problems
}

/** The block whose rows open data pages. */
const DATA_SETS_BLOCK = "core.data-sets"

/** The set id one item of a data sets node names, or none. */
const setOf = (item: unknown): ReadonlyArray<string> => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return []
    const set: unknown = Reflect.get(item, "set")
    return typeof set === "string" ? [set] : []
}

/** The set ids a data sets node lists. */
const setsOf = (node: SpecNode): ReadonlyArray<string> => {
    const items: unknown = node.props?.["items"]
    if (!Array.isArray(items)) return []
    return items.flatMap((item) => setOf(item))
}

/** Whether a view's tree is the desk: it shows how the agent works and what it just did. */
const isDesk = (root: SpecNode): boolean => {
    const nodes = nodesOf(root)
    return DESK_MARKS.every(([block, read]) =>
        nodes.some(
            (node) =>
                node.block === block &&
                Object.values(node.bind ?? {}).some((binding) => "read" in binding && binding.read === read),
        ),
    )
}

/** The rule's own findings on the views of one spec: the desk first (for an agent's module), data pages never tabs. */
const viewProblems = (
    declaration: ModuleDeclaration,
    spec: StoredSpec,
): ReadonlyArray<{ readonly code: WorkbenchRuleCode; readonly at: string }> => {
    const first = spec.views[0]
    const desk =
        declaration.agent === undefined || first === undefined || isDesk(first.root)
            ? []
            : [{ code: "SPEC_DESK_MISSING" as const, at: first.id }]
    const tabs = spec.views
        .filter((view) => isDataPage(view.id) && view.hidden !== true)
        .map((view) => ({ code: "SPEC_DATA_PAGE_TAB" as const, at: view.id }))
    const views = new Set(spec.views.map((view) => view.id))
    const missing = scopesOf(spec).flatMap(([scope, nodes]) =>
        nodes
            .filter((node) => node.block === DATA_SETS_BLOCK)
            .flatMap((node) =>
                setsOf(node)
                    .filter((set) => !views.has(dataSetViewOf(set)))
                    .map((set) => ({ code: "SPEC_DATA_PAGE_MISSING" as const, at: `${scope}/${node.id}.items.${set}` })),
            ),
    )
    return [...desk, ...tabs, ...missing]
}

/**
 * What is wrong with the seed specs of a module as a workbench: every `seedSpecProblems` finding (the SDK's), except that a binding to a
 * provider read (`<provider>:<read>`) is judged here against `providerReads`, the reads the providers offer the workspace's screens; and
 * the workbench rule (`SPEC_DESK_MISSING`, `SPEC_PROVIDER_TABLE_IN_DESK`, `SPEC_DATA_PAGE_TAB`). Empty when every seed spec may be stored,
 * drawn and opens on the agent's desk.
 */
export const workbenchSpecProblems = (
    declaration: ModuleDeclaration,
    blocks: ReadonlyArray<BlockDefinition>,
    shared: ReadonlyArray<ModuleDeclaration> = [],
    providerReads: ReadonlyArray<ProviderReadFacts> = [],
): ReadonlyArray<WorkbenchProblem> => {
    const blocksById = new Map(blocks.map((block) => [block.id, block]))
    const offered = new Map(providerReads.map((read) => [read.name, read]))
    const sdk = seedSpecProblems(declaration, blocks, shared)
    return declaration.specs.flatMap((spec, index): ReadonlyArray<WorkbenchProblem> => {
        const placed = providerBindingsOf(spec)
        const places = new Set(placed.map((entry) => entry.at))
        const own = sdk
            .filter((entry) => entry.spec === index && !isProviderUnknown(entry.problem.code, entry.problem.at, places))
            .map((entry): WorkbenchProblem => entry)
        const provider = placed.flatMap((entry) =>
            providerBindingProblems(entry, blocksById, offered).map((problem): WorkbenchProblem => ({ spec: index, problem })),
        )
        const views = viewProblems(declaration, spec).map((problem): WorkbenchProblem => ({ spec: index, problem }))
        return [...own, ...provider, ...views]
    })
}

/** Whether a zod schema (or one option of a union, or its `data` member: the provider envelope) answers a page: an `items` list. */
const answersPage = (schema: unknown, depth = 0): boolean => {
    if (depth > 3) return false
    if (schema instanceof z.ZodUnion) return schema.options.some((option) => answersPage(option, depth + 1))
    if (!(schema instanceof z.ZodObject)) return false
    const shape: Readonly<Record<string, unknown>> = schema.shape
    return shape["items"] instanceof z.ZodArray || answersPage(shape["data"], depth + 1)
}

/** The names of the argument members of a tool. */
const inputsOf = (args: unknown): ReadonlyArray<string> => (args instanceof z.ZodObject ? Object.keys(args.shape) : [])

/** The connector (namespace) of a tool id: what comes before its first dot. */
const connectorOf = (id: string): string => id.slice(0, id.indexOf("."))

/**
 * The reads the OpenAPI provider offers a person's screens (level 1, interface reads), as the package knows them: every tool declared
 * under one of `namespaces` that reads only (`mutates: false`), for a connector some module of
 * `modules` uses (the modules open to the workspace: a private plugin stays closed to others). A person's read is no agent's right:
 * whether an agent holds the tool does not matter (owner's standing rule: every member may view level-1 reads). Named by the API read of
 * the tool's operation when `apiOf` gives it (`openapi:<ApiVerb>`, the spelling a stored binding holds: `apiOf` joins a source's generated
 * `<KEY>` and `<KEY>_API` by their constant; a tool it gives no verb is no read), else `openapi:<tool id>`; a page when the declared answer
 * holds `items`. The provider also refuses an operation its pinned document lacks; a package cannot see that (the plugin's own document
 * spec does).
 */
export const openApiReadsOf = (
    tools: ReadonlyArray<ToolDefinition>,
    modules: ReadonlyArray<ModuleDeclaration>,
    namespaces: ReadonlyArray<string>,
    apiOf?: (tool: string) => ApiVerb | null,
): ReadonlyArray<ProviderReadFacts> => {
    const open = new Set(modules.flatMap((module) => module.agent?.tools ?? []).map((item) => connectorOf(item)))
    return tools
        .filter(
            (tool) =>
                !tool.mutates &&
                namespaces.includes(connectorOf(tool.id)) &&
                open.has(connectorOf(tool.id)),
        )
        .flatMap((tool): ReadonlyArray<ProviderReadFacts> => {
            const read = apiOf === undefined ? tool.id : apiOf(tool.id)
            if (read === null) return []
            return [{ name: `openapi:${read}`, shape: answersPage(tool.result) ? "list" : "record", inputs: inputsOf(tool.args) }]
        })
}
