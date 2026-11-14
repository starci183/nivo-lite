import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { FlowGraph, type FlowGraphRunStatus } from "@starci/grammar/common"
import type { graphBlock } from "../../blocks/graph.block"
import { EMPTY_FLOW, runPathOf } from "../../rows/graph-layout"
import { graphView, type GraphView, type RunPath } from "../../rows/graph-view"
import type { RunState } from "../../rows/run-state"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import { stepsFlowOf, stepsLegendOf, stepsStatusLabelsOf, type StepsFlow } from "../graph/steps-flow"
import type { RenderOf } from "../render-props"

/** The card status of each run state: a parked step waits too. */
const STATUSES: Readonly<Record<RunState, FlowGraphRunStatus>> = {
    running: "running",
    waiting: "waiting",
    parked: "waiting",
    failed: "failed",
    done: "done",
}

/**
 * The card map of the graph with the run overlay: while a run is chosen, each card it reached carries that step's status, a card it
 * never reached is skipped (faded), and an edge between two reached cards is taken. A graph with no node is null (an empty slot).
 */
const overlaidOf = (graph: GraphView, path: RunPath | null, locale: "vi" | "en"): StepsFlow | null => {
    if (graph.nodes.length === 0) return null
    const flow = stepsFlowOf(graph, locale)
    if (path === null) return flow
    const states = new Map(path.steps.map((step): [string, RunState] => [step.node, step.state]))
    return {
        nodes: flow.nodes.map((node) => {
            const state = states.get(node.id)
            return { ...node, status: state === undefined ? "skipped" : STATUSES[state] }
        }),
        edges: flow.edges.map((edge) => ({ ...edge, isTaken: states.has(edge.source) && states.has(edge.target) })),
    }
}

/**
 * A flow drawn as the card map by the Grammar (`layout="steps"`): white step cards with their kind icon, the branch ports of a
 * condition, dashed back edges and the kind legend. Choosing a card writes its id to the select param; while the run param names a
 * run, the cards that run reached carry its states and the others fade.
 */
export const GraphBlock = (props: RenderOf<typeof graphBlock>): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.empty)
    const locale = useBlockHost().locale() === "en" ? "en" : "vi"
    const { selectParam, runParam } = props.props
    const read = props.slots.graph
    const runId = runParam === undefined ? null : props.params.value(runParam)
    const path = runPathOf(props.slots.path.slot, runId)
    const flow = derivedSlot(parsedSlot(read.slot, graphView), (graph) => overlaidOf(graph, path, locale))
    return (
        <SlotView
            slot={flow}
            labels={labels}
            placeholder={EMPTY_FLOW}
            onRetry={read.retry}
            render={(items, isLoading) => (
                <FlowGraph
                    label={words(props.props.label)}
                    nodes={items.nodes}
                    edges={items.edges}
                    layout="steps"
                    legend={stepsLegendOf(locale)}
                    statusLabels={stepsStatusLabelsOf(locale)}
                    emptyLabel={labels.empty}
                    isLoading={isLoading}
                    {...(selectParam === undefined
                        ? {}
                        : {
                              selectedId: props.params.value(selectParam),
                              onSelect: (id: string | null) => props.params.set(selectParam, id),
                          })}
                />
            )}
        />
    )
}
