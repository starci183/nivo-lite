import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { FlowGraph } from "@starci/grammar/common"
import type { graphBlock } from "../../blocks/graph.block"
import { EMPTY_FLOW, graphFlowOf, runPathOf } from "../../rows/graph-layout"
import { graphView } from "../../rows/graph-view"
import { runStateLook } from "../../rows/run-state"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/**
 * A flow drawn in branch lanes by the Grammar. Choosing a node writes its id to the select param; while the run param names a run,
 * the nodes that run reached draw in its states and the others dim.
 */
export const GraphBlock = (props: RenderOf<typeof graphBlock>): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.empty)
    const { selectParam, runParam } = props.props
    const read = props.slots.graph
    const runId = runParam === undefined ? null : props.params.value(runParam)
    const path = runPathOf(props.slots.path.slot, runId)
    const flow = derivedSlot(parsedSlot(read.slot, graphView), (graph) =>
        graphFlowOf(graph, path, (state) => words({ key: runStateLook(state).key })),
    )
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
                    layout="lanes"
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
