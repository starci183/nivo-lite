import { z } from "zod"
import { RUN_STATES, type RunState } from "./run-state"

/** What a node of a graph is. */
export const GRAPH_NODE_KINDS = ["trigger", "step", "condition", "wait", "output"] as const

/** One kind of node. */
export type GraphNodeKind = (typeof GRAPH_NODE_KINDS)[number]

/** The state of a node: not reached yet, or one of the run states. */
export const GRAPH_NODE_STATES: readonly ["idle", "running", "waiting", "parked", "failed", "done"] = [
    "idle",
    "running",
    "waiting",
    "parked",
    "failed",
    "done",
]

/** One state of a node. */
export type GraphNodeState = "idle" | RunState

/** The most nodes and edges one graph carries; a bigger one is a failed read, never half a graph. */
export const GRAPH_NODES_MAX = 200
/** The most edges one graph carries. */
export const GRAPH_EDGES_MAX = 400
/** The most steps one run path carries. */
export const RUN_STEPS_MAX = 200

const ID_MAX = 120
const LABEL_MAX = 200
const DESCRIPTION_MAX = 500

/** One node of a graph as a read yields it. */
export interface GraphNodeView {
    /** The key of the node, unique in its graph. */
    readonly id: string
    /** The name drawn in the node. */
    readonly label: string
    /** What the node is. */
    readonly kind: GraphNodeKind
    /** The line under the name. */
    readonly description?: string | null | undefined
    /** The state of the node in the last run; absent means not reached. */
    readonly state?: GraphNodeState | null | undefined
}

/** One edge of a graph as a read yields it. */
export interface GraphEdgeView {
    /** The key of the edge, unique in its graph. */
    readonly id: string
    /** The id of the node the edge leaves. */
    readonly from: string
    /** The id of the node the edge enters. */
    readonly to: string
    /** The condition the edge is taken under; absent means always. */
    readonly condition?: string | null | undefined
}

/** A graph as a read yields it: the trigger, the nodes and the edges with their conditions. */
export interface GraphView {
    /** The nodes, in graph order. */
    readonly nodes: ReadonlyArray<GraphNodeView>
    /** The edges between them. */
    readonly edges: ReadonlyArray<GraphEdgeView>
}

const node: z.ZodType<GraphNodeView> = z.looseObject({
    id: z.string().min(1).max(ID_MAX),
    label: z.string().max(LABEL_MAX),
    kind: z.enum(GRAPH_NODE_KINDS),
    description: z.string().max(DESCRIPTION_MAX).nullish(),
    state: z.enum(GRAPH_NODE_STATES).nullish(),
})

const edge: z.ZodType<GraphEdgeView> = z.looseObject({
    id: z.string().min(1).max(ID_MAX),
    from: z.string().min(1).max(ID_MAX),
    to: z.string().min(1).max(ID_MAX),
    condition: z.string().max(LABEL_MAX).nullish(),
})

/** The shape of the graph read: nodes and edges, any further field (params, rights) is left to the blocks beside it. */
export const graphView: z.ZodType<GraphView> = z.looseObject({
    nodes: z.array(node).max(GRAPH_NODES_MAX),
    edges: z.array(edge).max(GRAPH_EDGES_MAX),
})

/** One step of the path a run took. */
export interface RunPathStep {
    /** The id of the node the step ran. */
    readonly node: string
    /** The state of the step. */
    readonly state: RunState
}

/** The path a run took through its graph. */
export interface RunPath {
    /** The steps, in the order they ran. */
    readonly steps: ReadonlyArray<RunPathStep>
}

const pathStep: z.ZodType<RunPathStep> = z.looseObject({
    node: z.string().min(1).max(ID_MAX),
    state: z.enum(RUN_STATES),
})

/** The shape of the run read as the graph uses it: the steps and the node each ran; the run's other fields are the timeline's. */
export const runPathView: z.ZodType<RunPath> = z.looseObject({
    steps: z.array(pathStep).max(RUN_STEPS_MAX),
})
