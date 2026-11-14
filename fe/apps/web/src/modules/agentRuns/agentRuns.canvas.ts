import type { FlowGraphRunStatus } from "@starci/grammar/common"
import { type GraphView } from "@/modules/plugin-registry"
import { nodeOfKey, stepsMapOf, type StepsLocale } from "@/modules/workflowSteps"
import type { RunCanvasView, RunGraphNode, RunLegendItem } from "@/modules/types"
import { durationOf, stepStatusOf, stepToneOf } from "./agentRuns.format"
import type { AgentRunStepWire, RunContext, RunStepStatus } from "./agentRuns.types"

/** The card status of each step status; a step still pending has none yet. */
const CARD_STATUSES: Readonly<Record<RunStepStatus, FlowGraphRunStatus | undefined>> = {
    pending: undefined,
    running: "running",
    waiting: "waiting",
    done: "done",
    failed: "failed",
    undone: "skipped",
}

/** The id of the trigger card `graphViewOfSpec` puts first. */
const TRIGGER = "trigger"

/** The step a node was reached by: the last one the run wrote for it, since a retry writes the node again. */
export const stepOfNode = (steps: ReadonlyArray<AgentRunStepWire>, nodeKey: string): AgentRunStepWire | undefined =>
    steps.findLast((step) => step.nodeKey === nodeKey)

/** The line a node says about its step: how long it took, that it waits, runs, or failed, or that the run never reached it. */
const lineOf = (step: AgentRunStepWire | undefined, isFinished: boolean, context: RunContext): string => {
    if (step === undefined) return isFinished ? context.t("nodeSkipped") : context.t("nodeNotRun")
    const status = stepStatusOf(step.status)
    const took = durationOf(step.durationMs, context)
    if (status === "failed")
        return took === "" ? context.t("nodeFailed") : context.t("nodeFailedAfter", { duration: took })
    if (status === "waiting") return context.t("nodeWaiting")
    if (status === "running") return context.t("nodeRunning")
    return took === "" ? context.t(`step_${status}`) : took
}

/** The status a card carries: its step's, the trigger's once any step ran, skipped for a node a finished run never reached. */
const cardStatusOf = (
    nodeKey: string,
    steps: ReadonlyArray<AgentRunStepWire>,
    isFinished: boolean,
): FlowGraphRunStatus | undefined => {
    if (nodeKey === TRIGGER) return steps.length > 0 ? "done" : undefined
    const step = stepOfNode(steps, nodeKey)
    if (step === undefined) return isFinished ? "skipped" : undefined
    return CARD_STATUSES[stepStatusOf(step.status)]
}

/** Whether the run went from one node to the next: both were reached and the second after the first (the trigger leads to any step). */
const takenOf = (steps: ReadonlyArray<AgentRunStepWire>) => (source: string, target: string) => {
    const to = stepOfNode(steps, target)
    if (source === TRIGGER) return to !== undefined
    const from = stepOfNode(steps, source)
    return from !== undefined && to !== undefined && to.ordinal > from.ordinal
}

/** The key under the map: the five states a card shows, in the words of the page. */
const legendOf = (context: RunContext): ReadonlyArray<RunLegendItem> =>
    (["done", "running", "waiting", "failed", "pending"] as const).map((status) => ({
        id: status,
        label: context.t(`legend_${status}`),
        tone: status === "pending" ? "neutral" : stepToneOf(status),
    }))

/**
 * The graph a run is drawn on as a graph view: the view of the flow when it holds every node the run went through, else the path the
 * run took, node by node (a run opened on an older version), each with the card of its node, else the card of the core node its key
 * names.
 */
export const runViewOf = (view: GraphView, map: ReadonlyArray<RunGraphNode>, locale: StepsLocale): GraphView => {
    const known = new Set(view.nodes.map((node) => node.id))
    if (map.every((node) => known.has(node.key))) return view
    return {
        nodes: map.map(
            (node) =>
                view.nodes.find((one) => one.id === node.key) ??
                nodeOfKey(node.key, locale) ?? { id: node.key, label: node.title, kind: "action" },
        ),
        edges: map.flatMap((node) =>
            node.next.map((target) => ({ id: `${node.key}->${target}`, from: node.key, to: target })),
        ),
    }
}

/**
 * The part of the graph a run is drawn on: the nodes the run went through and, for each, the nodes it could have gone to next (the
 * branches it did not take), with the edges between them. A flow of dozens of nodes drawn whole is too wide to read on a run page; a run
 * shows its own path and the forks it passed. A graph the run cannot be placed on (no step names one of its nodes) is drawn whole.
 */
export const pathViewOf = (view: GraphView, steps: ReadonlyArray<AgentRunStepWire>): GraphView => {
    const reached = new Set(steps.map((step) => step.nodeKey))
    if (!view.nodes.some((node) => reached.has(node.id))) return view
    const keep = new Set<string>([...reached, TRIGGER])
    view.edges.forEach((edge) => {
        if (keep.has(edge.from) && (reached.has(edge.from) || edge.from === TRIGGER)) keep.add(edge.to)
    })
    return {
        nodes: view.nodes.filter((node) => keep.has(node.id)),
        edges: view.edges.filter((edge) => keep.has(edge.from) && keep.has(edge.to)),
    }
}

/**
 * The card map of a run (`layout="steps"`): the graph the run ran on as white step cards, the run overlay on top (a status ring and
 * badge per card, a card a finished run never reached faded, the edges the run took solid in the accent), each card's line saying
 * how its step went; the kind legend and the status key under it.
 */
export const canvasOf = (
    steps: ReadonlyArray<AgentRunStepWire>,
    view: GraphView,
    isFinished: boolean,
    selectedKey: string,
    context: RunContext,
    locale: StepsLocale,
): RunCanvasView => {
    const map = stepsMapOf(view, locale)
    const isTaken = takenOf(steps)
    return {
        nodes: map.nodes.map((node) => {
            const status = cardStatusOf(node.id, steps, isFinished)
            const isStep = node.id !== TRIGGER && node.kind !== "end"
            return {
                ...node,
                ...(isStep ? { description: lineOf(stepOfNode(steps, node.id), isFinished, context) } : {}),
                ...(status === undefined ? {} : { status }),
            }
        }),
        edges: map.edges.map((edge) => ({ ...edge, isTaken: isTaken(edge.source, edge.target) })),
        kinds: map.legend,
        statusLabels: map.statusLabels,
        legend: legendOf(context),
        selectedId: selectedKey === "" ? null : selectedKey,
    }
}
