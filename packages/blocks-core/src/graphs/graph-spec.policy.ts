import { graphNodeProblems, isInputRef, sourceOfRef, TRIGGER_SOURCE } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition, NodeIndex, NodeInputBinding } from "@nivo-lite/agent-sdk/node"
import type { DataRight } from "@nivo-lite/agent-sdk/rights"
import { isNamespaced } from "@nivo-lite/agent-sdk/schema"
import type { GraphSpec, GraphSpecNode, GraphSpecProblem } from "./graph-spec.types"

/** The keys a node goes to next. */
const edgesOf = (node: GraphSpecNode): ReadonlyArray<string> => [
    ...(node.next === undefined ? [] : [node.next]),
    ...Object.values(node.routes ?? {}),
]

/** Every key reachable from the starting ones, by the edges of the nodes. */
const reachedFrom = (nodes: ReadonlyMap<string, GraphSpecNode>, start: ReadonlyArray<string>): ReadonlySet<string> => {
    const seen = new Set<string>()
    const pending = [...start]
    for (let key = pending.pop(); key !== undefined; key = pending.pop()) {
        const node = nodes.get(key)
        if (node === undefined || seen.has(key)) continue
        seen.add(key)
        pending.push(...edgesOf(node))
    }
    return seen
}

/** The problems of the keys: a duplicate, an edge to nowhere, a node the run never reaches. */
const shapeProblems = (spec: GraphSpec, nodes: ReadonlyMap<string, GraphSpecNode>): ReadonlyArray<GraphSpecProblem> => {
    const keys = spec.nodes.map((node) => node.key)
    const first = spec.nodes[0]
    const reached = first === undefined ? new Set<string>() : reachedFrom(nodes, [first.key])
    return [
        ...[...new Set(keys.filter((key, index) => keys.indexOf(key) !== index))].map(
            (at): GraphSpecProblem => ({ code: "GRAPH_NODE_DUPLICATE", at }),
        ),
        ...spec.nodes.flatMap((node) =>
            edgesOf(node)
                .filter((target) => !nodes.has(target))
                .map((target): GraphSpecProblem => ({ code: "GRAPH_TARGET_UNKNOWN", at: `${node.key}->${target}` })),
        ),
        ...keys.filter((key) => !reached.has(key)).map((at): GraphSpecProblem => ({ code: "GRAPH_NODE_UNREACHABLE", at })),
    ]
}

/** The sources a binding references, at any depth of a literal object or list. */
const sourcesOf = (binding: NodeInputBinding): ReadonlyArray<string> => {
    if (isInputRef(binding)) return [sourceOfRef(binding)]
    if (Array.isArray(binding)) return binding.flatMap(sourcesOf)
    return typeof binding === "object" && binding !== null ? Object.values(binding).flatMap(sourcesOf) : []
}

/** The problems of the references: a source that is neither the trigger nor a node the run has passed through to get here. */
const refProblems = (spec: GraphSpec, nodes: ReadonlyMap<string, GraphSpecNode>): ReadonlyArray<GraphSpecProblem> =>
    spec.nodes.flatMap((node) => {
        const upstream = spec.nodes.filter((other) => other.key !== node.key && reachedFrom(nodes, [other.key]).has(node.key))
        const known = new Set(upstream.map((other) => other.key))
        return [...new Set(Object.values(node.input ?? {}).flatMap(sourcesOf))]
            .filter((source) => source !== TRIGGER_SOURCE && !known.has(source))
            .map((source): GraphSpecProblem => ({ code: "GRAPH_REF_NOT_UPSTREAM", at: `${node.key}<-${source}` }))
    })

/** What a node needs the agent to hold: its own rights and those of every effect and tool it may use. */
const requiredRights = (node: NodeDefinition, index: NodeIndex): ReadonlyArray<DataRight> => [
    ...node.rights,
    ...node.effects.flatMap((effect) => index.effects.get(effect)?.rights ?? []),
    ...(node.tools ?? []).flatMap((tool) => index.tools.get(tool)?.rights ?? []),
]

/** The members of `granted` that `needed` does not contain. */
const surplus = (granted: ReadonlyArray<string>, needed: ReadonlyArray<string>): ReadonlyArray<string> =>
    [...new Set(granted)].filter((item) => !needed.includes(item))

/** The problems of a grant that holds more than its nodes need: a right, a field, a tool or an effect nobody uses. */
const minimumProblems = (spec: GraphSpec, installed: ReadonlyArray<NodeDefinition>, index: NodeIndex): ReadonlyArray<GraphSpecProblem> => {
    const rights = installed.flatMap((node) => requiredRights(node, index))
    const effects = installed.flatMap((node) => node.effects)
    const tools = installed.flatMap((node) => node.tools ?? [])
    const fieldsOf = (granted: DataRight): ReadonlyArray<string> =>
        rights.filter((right) => right.kind === granted.kind && right.access === granted.access).flatMap((right) => right.fields)
    return [
        ...spec.grant.rights.flatMap((granted) =>
            surplus(granted.fields, fieldsOf(granted)).map(
                (field): GraphSpecProblem => ({ code: "GRAPH_GRANT_EXCESS", at: `${granted.kind}:${granted.access}.${field}` }),
            ),
        ),
        ...surplus(spec.grant.effects, effects).map((at): GraphSpecProblem => ({ code: "GRAPH_GRANT_EXCESS", at })),
        ...surplus(spec.grant.tools, tools).map((at): GraphSpecProblem => ({ code: "GRAPH_GRANT_EXCESS", at })),
        ...surplus(effects, spec.grant.effects).map((at): GraphSpecProblem => ({ code: "GRAPH_EFFECTS_MISMATCH", at })),
        ...surplus(tools, spec.grant.tools).map((at): GraphSpecProblem => ({ code: "GRAPH_TOOLS_MISMATCH", at })),
    ]
}

/**
 * The problems of a graph spec against the installed nodes: its shape (keys, edges, references), every node as `graphNodeProblems`
 * judges it under the spec's own grant (a missing right is raised there), and a grant that holds more than its nodes need. A built-in step (`stop`) is not judged. A node whose
 * step is not installed is `NODE_UNKNOWN`, and the minimum is not judged while one is missing, since its needs are not known.
 */
export const graphSpecProblems = (spec: GraphSpec, index: NodeIndex): ReadonlyArray<GraphSpecProblem> => {
    const nodes = new Map(spec.nodes.map((node) => [node.key, node]))
    const grant = { rights: spec.grant.rights, tools: spec.grant.tools }
    const judged = spec.nodes.flatMap((node) => graphNodeProblems(node, index, grant))
    const steps = spec.nodes.filter((node) => isNamespaced(node.step))
    const installed = steps.flatMap((node) => index.nodes.get(node.step) ?? [])
    return [
        ...shapeProblems(spec, nodes),
        ...refProblems(spec, nodes),
        ...judged,
        ...(installed.length === steps.length ? minimumProblems(spec, installed, index) : []),
    ]
}
