import { burstIsSound } from "./graph-burst"
import { graphSpecJsonDocument } from "./graph-spec.schema"
import { BRANCH_FIELD, graphNodeProblems, inputSourcesOf, nodeSagaOf, TRIGGER_SOURCE } from "../node"
import type { NodeDefinition, NodeIndex } from "../node"
import type { DataRight } from "../rights/rights.types"
import type { GraphSpec, GraphSpecNode, GraphSpecProblem } from "./graph-spec.types"

/**
 * The JSON Schema of a graph spec, generated from `graphSpecSchema`: what a seed step that validates spec files by JSON Schema reads, so
 * the file and the zod schema can never say different things.
 */
export const graphSpecJsonSchema = (): Readonly<Record<string, unknown>> => graphSpecJsonDocument

/** The built-in step that ends a run and does nothing: the only step of a spec that is not an installed node. */
export const STOP_STEP = "stop"

/** The keys a node goes to next: its `next`, and every route of a condition. */
export const edgesOf = (node: GraphSpecNode): ReadonlyArray<string> => [
    ...(node.next === undefined ? [] : [node.next]),
    ...Object.values(node.routes ?? {}),
]

/**
 * The key a run goes to after a node, from what the node answered: a condition follows the route of its `branch`, any other node its
 * `next`; null ends the run (no next, or a branch without a route).
 */
export const nextKeyOf = (node: GraphSpecNode, output: unknown): string | null => {
    if (node.routes === undefined) return node.next ?? null
    const branch: unknown =
        typeof output === "object" && output !== null ? Reflect.get(output, BRANCH_FIELD) : undefined
    return typeof branch === "string" ? (node.routes[branch] ?? null) : null
}

/** Every key reachable from the starting ones, by the edges of the nodes. */
const reachedFrom = (nodes: ReadonlyMap<string, GraphSpecNode>, start: ReadonlyArray<string>): ReadonlySet<string> => {
    const seen = new Set<string>()
    const pending = [...start]
    for (let key = pending.pop(); key !== undefined; key = pending.pop()) {
        const node = nodes.get(key)
        if (node !== undefined && !seen.has(key)) {
            seen.add(key)
            pending.push(...edgesOf(node))
        }
    }
    return seen
}

/** The problems of the keys: a duplicate, an edge to nowhere, a node the run never reaches. */
const shapeProblems = (spec: GraphSpec, nodes: ReadonlyMap<string, GraphSpecNode>): ReadonlyArray<GraphSpecProblem> => {
    const keys = spec.nodes.map((node) => node.key)
    const first = spec.nodes[0]
    const reached = first === undefined ? new Set<string>() : reachedFrom(nodes, [first.key])
    return [
        ...[...new Set(keys.filter((key, index) => keys.indexOf(key) !== index))].map((at): GraphSpecProblem => ({
            code: "GRAPH_NODE_DUPLICATE",
            at,
        })),
        ...spec.nodes.flatMap((node) =>
            edgesOf(node)
                .filter((target) => !nodes.has(target))
                .map((target): GraphSpecProblem => ({ code: "GRAPH_TARGET_UNKNOWN", at: `${node.key}->${target}` })),
        ),
        ...keys
            .filter((key) => !reached.has(key))
            .map((at): GraphSpecProblem => ({ code: "GRAPH_NODE_UNREACHABLE", at })),
    ]
}

/** The problems of the references: a source that is neither the trigger nor a node the run passed through to get here. */
const refProblems = (spec: GraphSpec, nodes: ReadonlyMap<string, GraphSpecNode>): ReadonlyArray<GraphSpecProblem> =>
    spec.nodes.flatMap((node) => {
        const upstream = spec.nodes.filter(
            (other) => other.key !== node.key && reachedFrom(nodes, [other.key]).has(node.key),
        )
        const known = new Set(upstream.map((other) => other.key))
        return inputSourcesOf(node.input ?? {})
            .filter((source) => source !== TRIGGER_SOURCE && !known.has(source))
            .map((source): GraphSpecProblem => ({ code: "GRAPH_REF_NOT_UPSTREAM", at: `${node.key}<-${source}` }))
    })

/**
 * The saga rule: a compensable node reachable after a pivot could never be undone (the run goes forward past a pivot, never back), so
 * each one is named. A node not installed is judged elsewhere.
 */
const sagaProblems = (
    spec: GraphSpec,
    nodes: ReadonlyMap<string, GraphSpecNode>,
    index: NodeIndex,
): ReadonlyArray<GraphSpecProblem> => {
    const sagaOf = (node: GraphSpecNode): string | null => {
        const definition = index.nodes.get(node.step)
        return definition === undefined ? null : nodeSagaOf(definition, index)
    }
    const after = spec.nodes
        .filter((node) => sagaOf(node) === "pivot")
        .flatMap((pivot) => [...reachedFrom(nodes, edgesOf(pivot))])
    return [...new Set(after)]
        .filter((key) => {
            const node = nodes.get(key)
            return node !== undefined && sagaOf(node) === "compensable"
        })
        .map((at): GraphSpecProblem => ({ code: "GRAPH_COMPENSABLE_AFTER_PIVOT", at }))
}

/** The problems of the trigger's burst: an entry that is not sound durations, or one for a source the trigger does not list. */
const burstProblems = (spec: GraphSpec): ReadonlyArray<GraphSpecProblem> =>
    Object.entries(spec.trigger.burst ?? {})
        .filter(
            ([source, burst]) =>
                !new Set<string>(spec.trigger.sources).has(source) || (burst !== undefined && !burstIsSound(burst)),
        )
        .map(([at]): GraphSpecProblem => ({ code: "GRAPH_BURST_INVALID", at: `burst.${at}` }))

/** What a node needs the agent to hold: its own rights and those of every effect and tool it may use. */
const requiredRights = (node: NodeDefinition, index: NodeIndex): ReadonlyArray<DataRight> => [
    ...node.rights,
    ...node.effects.flatMap((effect) => index.effects.get(effect)?.rights ?? []),
    ...(node.tools ?? []).flatMap((tool) => index.tools.get(tool)?.rights ?? []),
]

/** The members of `granted` that `needed` does not contain. */
const surplus = (granted: ReadonlyArray<string>, needed: ReadonlyArray<string>): ReadonlyArray<string> =>
    [...new Set(granted)].filter((item) => !needed.includes(item))

/** The problems of a grant that holds more than its nodes need, or lists fewer effects or tools than they use. */
const minimumProblems = (
    spec: GraphSpec,
    installed: ReadonlyArray<NodeDefinition>,
    index: NodeIndex,
): ReadonlyArray<GraphSpecProblem> => {
    const rights = installed.flatMap((node) => requiredRights(node, index))
    const effects = installed.flatMap((node) => node.effects)
    const tools = installed.flatMap((node) => node.tools ?? [])
    const fieldsOf = (granted: DataRight): ReadonlyArray<string> =>
        rights
            .filter((right) => right.kind === granted.kind && right.access === granted.access)
            .flatMap((right) => right.fields)
    return [
        ...spec.grant.rights.flatMap((granted) =>
            surplus(granted.fields, fieldsOf(granted)).map((field): GraphSpecProblem => ({
                code: "GRAPH_GRANT_EXCESS",
                at: `${granted.kind}:${granted.access}.${field}`,
            })),
        ),
        ...surplus(spec.grant.effects, effects).map((at): GraphSpecProblem => ({ code: "GRAPH_GRANT_EXCESS", at })),
        ...surplus(spec.grant.tools, tools).map((at): GraphSpecProblem => ({ code: "GRAPH_GRANT_EXCESS", at })),
        ...surplus(effects, spec.grant.effects).map((at): GraphSpecProblem => ({ code: "GRAPH_EFFECTS_MISMATCH", at })),
        ...surplus(tools, spec.grant.tools).map((at): GraphSpecProblem => ({ code: "GRAPH_TOOLS_MISMATCH", at })),
    ]
}

/**
 * The problems of a graph spec against the installed nodes: its shape (keys, edges, references), the saga rule (nothing undoable after a
 * pivot), every node as `graphNodeProblems`
 * judges it under the spec's own grant, and a grant that holds more than its nodes need. A step that is not installed is
 * `NODE_UNKNOWN` (any built-in step but `stop`: a spec is composed of SDK nodes), and the minimum is not judged while one is missing.
 */
export const graphSpecProblems = (spec: GraphSpec, index: NodeIndex): ReadonlyArray<GraphSpecProblem> => {
    const nodes = new Map(spec.nodes.map((node) => [node.key, node]))
    const grant = { rights: spec.grant.rights, tools: spec.grant.tools }
    const working = spec.nodes.filter((node) => node.step !== STOP_STEP)
    const judged = working.flatMap((node): ReadonlyArray<GraphSpecProblem> =>
        index.nodes.has(node.step) ? graphNodeProblems(node, index, grant) : [{ code: "NODE_UNKNOWN", at: node.key }],
    )
    const installed = working.flatMap((node) => index.nodes.get(node.step) ?? [])
    return [
        ...shapeProblems(spec, nodes),
        ...burstProblems(spec),
        ...refProblems(spec, nodes),
        ...sagaProblems(spec, nodes, index),
        ...judged,
        ...(installed.length === working.length ? minimumProblems(spec, installed, index) : []),
    ]
}
