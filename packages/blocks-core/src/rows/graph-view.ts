import { z } from "zod"
import { PARAM_INPUTS } from "../nodes/node-params"
import type { ParamField } from "../nodes/node-params"
import type { NodeOutputView } from "../nodes/node-cards"
import { RUN_STATES } from "./run-state"
import type { BindingView, CallView, EntryView, OutcomeEndView, OutcomeView, TriggerView } from "./workflow-contract-view"
import type { RunState } from "./run-state"

/**
 * What a node of a graph is. `trigger`, `step`, `output` are the first drawing of a graph; `event`, `action`, `ask`, `end` (with `condition`
 * and `wait`, shared) are the card style: see `NODE_KINDS` in the nodes.
 */
export const GRAPH_NODE_KINDS = ["trigger", "step", "condition", "wait", "output", "event", "action", "ask", "end"] as const

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
const OUTPUTS_MAX = 20
const PARAMS_MAX = 40
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
    /** The id of the node type the node runs (`payment.match-code`), or `trigger` or `stop`. */
    readonly step?: string | undefined
    /** The short name of the card (the same words as `label`). */
    readonly title?: string | undefined
    /** What the step does in at most five words (the same words as `description`). */
    readonly subtitle?: string | undefined
    /** The icon name of the card (`bank`, `search`, `git-branch`, ...). */
    readonly icon?: string | undefined
    /** The Heroicons export that icon stands for, to hand to Grammar's `Icon` as its source. */
    readonly heroicon?: string | undefined
    /** The sub-flow the node belongs to (`consult`, `care`), when the graph groups it. */
    readonly group?: string | undefined
    /** The named outputs of a condition, each with its words; empty for every other node. */
    readonly outputs?: ReadonlyArray<NodeOutputView> | undefined
    /** The values of the node's settings in this graph, defaults filled in. */
    readonly params?: Readonly<Record<string, unknown>> | undefined
    /** The settings with their form metadata (label, help, input, limits, options) and values, hidden ones marked. */
    readonly paramFields?: ReadonlyArray<ParamField> | undefined
    /** Every param binding of the node (settings and data): a ref as a pink chip `= steps.x.output.y`, a fixed value plain. */
    readonly bindings?: ReadonlyArray<BindingView> | undefined
    /** For an end hand-off (`core.call-workflow`): the exact target and its param table. */
    readonly call?: CallView | undefined
    /** For an outcome end (`core.outcome`): the outcome and the outputs it fills. */
    readonly outcome?: OutcomeEndView | undefined
    /** For a "Lặp qua từng" step: the list it loops over, the most items and the keys of its body. */
    readonly loop?: LoopView | undefined
    /** The loop step whose body holds this node, when it is inside one. */
    readonly parent?: string | undefined
}

/** A for-each step as its container card draws it. */
export interface LoopView {
    readonly items: BindingView | null
    readonly max: number
    readonly bodyKeys: ReadonlyArray<string>
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
    /** The output of the condition the edge leaves from; the first when several outputs lead to the same node. */
    readonly fromOutput?: string | undefined
    /** Every output of the condition that leads to the target. */
    readonly fromOutputs?: ReadonlyArray<string> | undefined
    /** The words on the edge: the output's label (or "others"), or why a back edge returns. */
    readonly label?: string | undefined
    /** True for an edge that returns to an earlier or merged step after an owner decision or a timeout. */
    readonly back?: boolean | undefined
}

/** A graph as a read yields it: the trigger, the nodes and the edges with their conditions. */
export interface GraphView {
    /** The nodes, in graph order. */
    readonly nodes: ReadonlyArray<GraphNodeView>
    /** The edges between them. */
    readonly edges: ReadonlyArray<GraphEdgeView>
    /** The inputs of the workflow (a source, its conditions and the params it supplies); absent for a graph without contracts. */
    readonly triggers?: ReadonlyArray<TriggerView> | undefined
    /** The named outcomes of the workflow. */
    readonly outcomes?: ReadonlyArray<OutcomeView> | undefined
    /** Who may call the workflow. */
    readonly entry?: EntryView | undefined
}

const paramField: z.ZodType<ParamField> = z.looseObject({
    name: z.string().max(ID_MAX),
    label: z.string().max(LABEL_MAX),
    help: z.string().max(DESCRIPTION_MAX),
    input: z.enum(PARAM_INPUTS),
    hidden: z.boolean(),
    required: z.boolean(),
})

const node: z.ZodType<GraphNodeView> = z.looseObject({
    id: z.string().min(1).max(ID_MAX),
    label: z.string().max(LABEL_MAX),
    kind: z.enum(GRAPH_NODE_KINDS),
    description: z.string().max(DESCRIPTION_MAX).nullish(),
    state: z.enum(GRAPH_NODE_STATES).nullish(),
    step: z.string().max(ID_MAX).optional(),
    title: z.string().max(LABEL_MAX).optional(),
    subtitle: z.string().max(DESCRIPTION_MAX).optional(),
    icon: z.string().max(ID_MAX).optional(),
    heroicon: z.string().max(ID_MAX).optional(),
    group: z.string().max(ID_MAX).optional(),
    outputs: z.array(z.looseObject({ id: z.string().max(ID_MAX), label: z.string().max(LABEL_MAX) })).max(OUTPUTS_MAX).optional(),
    params: z.looseObject({}).optional(),
    paramFields: z.array(paramField).max(PARAMS_MAX).optional(),
})

const edge: z.ZodType<GraphEdgeView> = z.looseObject({
    id: z.string().min(1).max(ID_MAX),
    from: z.string().min(1).max(ID_MAX),
    to: z.string().min(1).max(ID_MAX),
    condition: z.string().max(LABEL_MAX).nullish(),
    fromOutput: z.string().max(ID_MAX).optional(),
    fromOutputs: z.array(z.string().max(ID_MAX)).max(OUTPUTS_MAX).optional(),
    label: z.string().max(LABEL_MAX).optional(),
    back: z.boolean().optional(),
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
