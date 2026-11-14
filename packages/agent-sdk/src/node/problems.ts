import { z } from "../schema/zod-entry"
import { isNamespaced } from "../schema/namespaced"
import type { DataKindDefinition, EffectDefinition, ToolDefinition } from "./effect.types"
import { BRANCH_FIELD } from "./node"
import { fixedParamsOf, isBindings, paramRefsOf, schemaKeysOf } from "./memory"
import type { ParamBindings } from "./memory.contracts"
import type { NodeDefinition, NodeGrant } from "./node.types"

/** What a node list or a graph node that names one is refused for. */
export type NodeProblemCode =
    | "NODE_DUPLICATE"
    | "EFFECT_DUPLICATE"
    | "TOOL_DUPLICATE"
    | "DATA_KIND_DUPLICATE"
    | "NODE_EFFECT_UNKNOWN"
    | "NODE_TOOL_UNKNOWN"
    | "NODE_CONDITION_MUTATES"
    | "NODE_UNKNOWN"
    | "NODE_ROLE_MISMATCH"
    | "NODE_PARAMS_INVALID"
    | "NODE_ROUTE_MISSING"
    | "NODE_TOOLS_UNGRANTED"

/** One problem and where it is: a node, effect or data kind id, or a graph node key. */
export interface NodeProblem {
    /** The kind of problem, from a closed list. */
    readonly code: NodeProblemCode
    /** The id or key the problem is at. */
    readonly at: string
}

/** What an app installs: the nodes, the effects they may run, the NIVO MCP tools they may call and the data kinds its ports serve. */
export interface NodeInstall {
    /** The node definitions the app installs. */
    readonly nodes: ReadonlyArray<NodeDefinition>
    /** The effects the installed nodes may run. */
    readonly effects: ReadonlyArray<EffectDefinition>
    /** The NIVO MCP tools the installed nodes may call. */
    readonly tools: ReadonlyArray<ToolDefinition>
    /** The data kinds the host's data ports serve. */
    readonly dataKinds: ReadonlyArray<DataKindDefinition>
    /** The words of the install's text keys, in the language model calls are written in; undefined for a key it does not know. */
    readonly words?: ((key: string) => string | undefined) | undefined
}

/** The install by id, for lookups. */
export interface NodeIndex {
    /** The node definitions by node id. */
    readonly nodes: ReadonlyMap<string, NodeDefinition>
    /** The effect definitions by effect id. */
    readonly effects: ReadonlyMap<string, EffectDefinition>
    /** The tool definitions by tool id. */
    readonly tools: ReadonlyMap<string, ToolDefinition>
    /** The data kind definitions by kind id. */
    readonly dataKinds: ReadonlyMap<string, DataKindDefinition>
}

/** A graph node as the problems read it: its key, kind and step, and what it sets on the node its step names. */
export interface GraphNodeRef {
    /** The key of the node in the graph. */
    readonly key: string
    /** The role of the node in the graph. */
    readonly kind: string
    /** The id of the node definition the step names. */
    readonly step: string
    /** What the graph node sets on the node definition, as written. */
    readonly params?: unknown
    /** The next node key by outcome name, when the node routes. */
    readonly routes?: Readonly<Record<string, string>> | undefined
}

/** The install indexed by id. */
export const nodeIndexOf = (install: NodeInstall): NodeIndex => ({
    nodes: new Map(install.nodes.map((node) => [node.id, node])),
    effects: new Map(install.effects.map((effect) => [effect.id, effect])),
    tools: new Map(install.tools.map((tool) => [tool.id, tool])),
    dataKinds: new Map(install.dataKinds.map((kind) => [kind.kind, kind])),
})

/** One problem per id that appears more than once. */
const duplicates = (ids: ReadonlyArray<string>, code: NodeProblemCode): ReadonlyArray<NodeProblem> =>
    [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))].map((at) => ({ code, at }))

/** The problems of the tools a node declares: one nobody installed, or one that mutates in a condition, which must stay pure. */
const toolProblems = (node: NodeDefinition, tools: ReadonlyMap<string, ToolDefinition>): ReadonlyArray<NodeProblem> =>
    (node.tools ?? []).flatMap((name): ReadonlyArray<NodeProblem> => {
        const tool = tools.get(name)
        if (tool === undefined) return [{ code: "NODE_TOOL_UNKNOWN", at: `${node.id}:${name}` }]
        return tool.mutates && node.role === "condition"
            ? [{ code: "NODE_CONDITION_MUTATES", at: `${node.id}:${name}` }]
            : []
    })

/**
 * The problems of an install: duplicates, effects and tools a node declares and nobody installed, and a condition that calls a mutating
 * tool.
 */
export const nodeListProblems = (install: NodeInstall): ReadonlyArray<NodeProblem> => {
    const index = nodeIndexOf(install)
    return [
        ...duplicates(
            install.nodes.map((node) => node.id),
            "NODE_DUPLICATE",
        ),
        ...duplicates(
            install.effects.map((effect) => effect.id),
            "EFFECT_DUPLICATE",
        ),
        ...duplicates(
            install.tools.map((tool) => tool.id),
            "TOOL_DUPLICATE",
        ),
        ...duplicates(
            install.dataKinds.map((kind) => kind.kind),
            "DATA_KIND_DUPLICATE",
        ),
        ...install.nodes.flatMap((node) => [
            ...node.effects
                .filter((effect) => !index.effects.has(effect))
                .map((effect): NodeProblem => ({ code: "NODE_EFFECT_UNKNOWN", at: `${node.id}:${effect}` })),
            ...toolProblems(node, index.tools),
        ]),
    ]
}

/** The branches a condition answers when its `branch` is an enum, or null when it may be any text. */
export const branchesOf = (node: NodeDefinition): ReadonlyArray<string> | null => {
    const output = node.output
    const branch: unknown = output instanceof z.ZodObject ? Reflect.get(output.shape, BRANCH_FIELD) : undefined
    return branch instanceof z.ZodEnum ? branch.options.map(String) : null
}

/** The problems of a condition's routes: none at all, or an enum branch without a route. */
const routeProblems = (node: NodeDefinition, ref: GraphNodeRef): ReadonlyArray<NodeProblem> => {
    if (node.role !== "condition") return []
    const routes = ref.routes ?? {}
    const branches = branchesOf(node)
    const missing = branches === null ? Object.keys(routes).length === 0 : branches.some((name) => !(name in routes))
    return missing ? [{ code: "NODE_ROUTE_MISSING", at: ref.key }] : []
}

/**
 * Whether the settings a graph node writes are ones its params schema takes: only the members of the params schema are judged (the
 * others feed the node's input), each ref stands for its default, and a ref without one is left out of the judging (it is checked by
 * type at save, `graphRefProblems`).
 */
const paramsSound = (node: NodeDefinition, written: unknown): boolean => {
    const bindings: ParamBindings = isBindings(written) ? written : {}
    const settings = schemaKeysOf(node.params)
    const inputs = schemaKeysOf(node.input)
    const fixed = Object.fromEntries(
        Object.entries(fixedParamsOf(bindings)).filter(
            ([name]) => settings === null || settings.has(name) || !inputs?.has(name),
        ),
    )
    const unbound = new Set(
        paramRefsOf(bindings)
            .filter(({ field, ref }) => ref.default === undefined && !(field in fixed))
            .map(({ field }) => field),
    )
    const parsed = node.params.safeParse(fixed)
    return parsed.success || parsed.error.issues.every((issue) => unbound.has(String(issue.path[0] ?? "")))
}

/** Whether a grant names each of the tools a node declares. */
const granted = (node: NodeDefinition, grant: NodeGrant): boolean =>
    (node.tools ?? []).every((name) => (grant.tools ?? []).includes(name))

/**
 * The problems of one graph node against the install and the agent's grant. A step that is not a namespaced id is a built-in step and
 * is not judged here; a namespaced one must be installed, under its role, with params its schema takes, a route for each branch of a
 * condition, and a grant that names its tools.
 */
export const graphNodeProblems = (
    ref: GraphNodeRef,
    index: NodeIndex,
    grant: NodeGrant,
): ReadonlyArray<NodeProblem> => {
    if (!isNamespaced(ref.step)) return []
    const node = index.nodes.get(ref.step)
    if (node === undefined) return [{ code: "NODE_UNKNOWN", at: ref.key }]
    return [
        ...(node.role === ref.kind ? [] : [{ code: "NODE_ROLE_MISMATCH", at: ref.key } as const]),
        ...(paramsSound(node, ref.params)
            ? []
            : [{ code: "NODE_PARAMS_INVALID", at: ref.key } as const]),
        ...routeProblems(node, ref),
        ...(granted(node, grant) ? [] : [{ code: "NODE_TOOLS_UNGRANTED", at: ref.key } as const]),
    ]
}
