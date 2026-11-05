import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { FlowGraphEdge, FlowGraphNode } from "@starci/grammar/common" with { "resolution-mode": "import" }
import { runPathView } from "./graph-view"
import type { GraphNodeKind, GraphNodeView, GraphView, RunPath } from "./graph-view"
import { runStateLook } from "./run-state"
import type { RunState } from "./run-state"

/** A graph as the Grammar draws it: nodes and edges, ranked into branch lanes by the Grammar from the edges. */
export interface GraphFlow {
    /** The nodes, in graph order. */
    readonly nodes: ReadonlyArray<FlowGraphNode>
    /** The edges whose both ends are nodes of the graph. */
    readonly edges: ReadonlyArray<FlowGraphEdge>
}

/** A graph with nothing in it, for the skeleton. */
export const EMPTY_FLOW: GraphFlow = { nodes: [], edges: [] }

/** The Grammar kind of each kind of node: a wait is a step that stops for a person. */
const FLOW_KINDS: Readonly<Record<GraphNodeKind, NonNullable<FlowGraphNode["kind"]>>> = {
    trigger: "trigger",
    step: "execute",
    condition: "condition",
    wait: "execute",
    output: "output",
}

/** The state each node reached in the run chosen on the screen; none when no run is chosen. */
const pathStates = (path: RunPath | null): ReadonlyMap<string, RunState> | null =>
    path === null ? null : new Map(path.steps.map((step): [string, RunState] => [step.node, step.state]))

/** The state a node is drawn in: the run's when a run is chosen, else the one the graph carries. */
const stateOf = (node: GraphNodeView, states: ReadonlyMap<string, RunState> | null): RunState | null => {
    if (states !== null) return states.get(node.id) ?? null
    return node.state === undefined || node.state === null || node.state === "idle" ? null : node.state
}

/** The lines under a node's name: the words of its state, then its own line. */
const descriptionOf = (node: GraphNodeView, state: RunState | null, stateWords: (state: RunState) => string): string =>
    [state === null ? "" : stateWords(state), node.description ?? ""].filter((line) => line !== "").join(" · ")

/** The tone of a node: its state's, else a wait stays cautionary because it stops for a person. */
const toneOf = (node: GraphNodeView, state: RunState | null): "warning" | "info" | "danger" | "success" | undefined => {
    if (state !== null) return runStateLook(state).tone
    return node.kind === "wait" ? "warning" : undefined
}

/** A node as the Grammar draws it. */
const flowNodeOf = (
    node: GraphNodeView,
    states: ReadonlyMap<string, RunState> | null,
    stateWords: (state: RunState) => string,
): FlowGraphNode => {
    const state = stateOf(node, states)
    const description = descriptionOf(node, state, stateWords)
    const tone = toneOf(node, state)
    return {
        id: node.id,
        label: node.label,
        kind: FLOW_KINDS[node.kind],
        ...(description === "" ? {} : { description }),
        ...(tone === undefined ? {} : { tone }),
        ...(node.kind === "wait" ? { shape: "round" as const } : {}),
        ...(states !== null && state === null ? { isDimmed: true } : {}),
    }
}

/** The items with the first of a repeated id kept. */
const uniqueById = <T extends { readonly id: string }>(items: ReadonlyArray<T>): ReadonlyArray<T> => {
    const seen = new Set<string>()
    return items.filter((item) => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
    })
}

/**
 * The graph as the Grammar draws it, in graph order. Each node carries its kind (trigger, condition, step, output; a wait is a
 * rounded, cautionary step), the words of its state and, while a run is chosen, that run's state; a node the run never reached is
 * dimmed, so the path stands out. An edge carries its condition as its label; an edge to or from a node the graph does not hold
 * is dropped, never drawn half. A graph with no node is null, which the block reads as an empty slot.
 */
export const graphFlowOf = (
    graph: GraphView,
    path: RunPath | null,
    stateWords: (state: RunState) => string,
): GraphFlow | null => {
    const nodes = uniqueById(graph.nodes)
    if (nodes.length === 0) return null
    const states = pathStates(path)
    const ids = new Set(nodes.map((node) => node.id))
    const edges = uniqueById(graph.edges)
        .filter((edge) => ids.has(edge.from) && ids.has(edge.to))
        .map((edge): FlowGraphEdge => ({
            id: edge.id,
            source: edge.from,
            target: edge.to,
            ...(edge.condition === undefined || edge.condition === null || edge.condition === ""
                ? {}
                : { label: edge.condition }),
        }))
    return { nodes: nodes.map((node) => flowNodeOf(node, states, stateWords)), edges }
}

/** The path of the chosen run, from the slot of the read bound with the run; none while no run is chosen or the read has not answered. */
export const runPathOf = (slot: DataSlot<unknown>, runId: string | null): RunPath | null => {
    if (runId === null || !("items" in slot)) return null
    const parsed = runPathView.safeParse(slot.items)
    return parsed.success ? parsed.data : null
}
