import { z } from "../schema/zod-entry"
import { rightsGaps } from "../rights/rights"
import type { DataRight, RightsGrant } from "../rights/rights.types"
import { isNamespaced } from "../schema/namespaced"
import type { DataKindDefinition, EffectDefinition, ToolDefinition } from "./effect.types"
import { BRANCH_FIELD } from "./node"
import type { NodeDefinition } from "./node.types"

/** What a node list or a graph node that names one is refused for. */
export type NodeProblemCode =
    | "NODE_DUPLICATE"
    | "EFFECT_DUPLICATE"
    | "TOOL_DUPLICATE"
    | "DATA_KIND_DUPLICATE"
    | "NODE_EFFECT_UNKNOWN"
    | "EFFECT_COMPENSATION_UNKNOWN"
    | "NODE_TOOL_UNKNOWN"
    | "NODE_CONDITION_MUTATES"
    | "RIGHT_KIND_UNKNOWN"
    | "RIGHT_FIELD_UNKNOWN"
    | "NODE_UNKNOWN"
    | "NODE_ROLE_MISMATCH"
    | "NODE_PARAMS_INVALID"
    | "NODE_ROUTE_MISSING"
    | "NODE_RIGHTS_UNGRANTED"

/** One problem and where it is: a node, effect or data kind id, or a graph node key. */
export interface NodeProblem {
    /** The kind of problem, from a closed list. */
    readonly code: NodeProblemCode
    /** The id or key the problem is at. */
    readonly at: string
}

/** What an app installs: the nodes, the effects they may run, the NIVO MCP tools they may call and the data kinds rights may name. */
export interface NodeInstall {
    /** The node definitions the app installs. */
    readonly nodes: ReadonlyArray<NodeDefinition>
    /** The effects the installed nodes may run. */
    readonly effects: ReadonlyArray<EffectDefinition>
    /** The NIVO MCP tools the installed nodes may call. */
    readonly tools: ReadonlyArray<ToolDefinition>
    /** The data kinds rights may name. */
    readonly dataKinds: ReadonlyArray<DataKindDefinition>
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

/** The problems of rights against the installed data kinds: an unknown kind, or a field the kind does not have. */
const rightProblems = (
    rights: ReadonlyArray<DataRight>,
    kinds: ReadonlyMap<string, DataKindDefinition>,
    at: string,
): ReadonlyArray<NodeProblem> =>
    rights.flatMap((right): ReadonlyArray<NodeProblem> => {
        const kind = kinds.get(right.kind)
        if (kind === undefined) return [{ code: "RIGHT_KIND_UNKNOWN", at: `${at}:${right.kind}` }]
        return right.fields
            .filter((field) => !kind.fieldNames.includes(field))
            .map((field) => ({ code: "RIGHT_FIELD_UNKNOWN", at: `${at}:${right.kind}.${field}` }))
    })

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
 * The problems of an install: duplicates, effects and tools a node declares and nobody installed, a condition that calls a mutating
 * tool, rights over unknown kinds or fields, and an effect whose compensation nobody installed.
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
            ...rightProblems(node.rights, index.dataKinds, node.id),
        ]),
        ...install.effects.flatMap((effect) => rightProblems(effect.rights, index.dataKinds, effect.id)),
        ...install.effects
            .filter((effect) => effect.compensation !== undefined && !index.effects.has(effect.compensation))
            .map((effect): NodeProblem => ({
                code: "EFFECT_COMPENSATION_UNKNOWN",
                at: `${effect.id}:${effect.compensation}`,
            })),
        ...install.tools.flatMap((tool) => rightProblems(tool.rights, index.dataKinds, tool.id)),
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

/** Whether a grant covers what a node requires, the rights of every effect and tool it may use, and names each of its tools. */
const granted = (node: NodeDefinition, index: NodeIndex, grant: RightsGrant): boolean => {
    const tools = node.tools ?? []
    const named = tools.every((name) => (grant.tools ?? []).includes(name))
    const rights = [
        ...node.rights,
        ...node.effects.flatMap((effect) => index.effects.get(effect)?.rights ?? []),
        ...tools.flatMap((name) => index.tools.get(name)?.rights ?? []),
    ]
    return named && rightsGaps(grant, rights).length === 0
}

/**
 * The problems of one graph node against the install and the agent's grant. A step that is not a namespaced id is a built-in step and
 * is not judged here; a namespaced one must be installed, under its role, with params its schema takes, a route for each branch of a
 * condition, and a grant that covers its rights, its effects' and its tools', and names its tools.
 */
export const graphNodeProblems = (
    ref: GraphNodeRef,
    index: NodeIndex,
    grant: RightsGrant,
): ReadonlyArray<NodeProblem> => {
    if (!isNamespaced(ref.step)) return []
    const node = index.nodes.get(ref.step)
    if (node === undefined) return [{ code: "NODE_UNKNOWN", at: ref.key }]
    return [
        ...(node.role === ref.kind ? [] : [{ code: "NODE_ROLE_MISMATCH", at: ref.key } as const]),
        ...(node.params.safeParse(ref.params ?? {}).success
            ? []
            : [{ code: "NODE_PARAMS_INVALID", at: ref.key } as const]),
        ...routeProblems(node, ref),
        ...(granted(node, index, grant) ? [] : [{ code: "NODE_RIGHTS_UNGRANTED", at: ref.key } as const]),
    ]
}
