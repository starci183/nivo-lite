import {
    Badge,
    Button,
    FlowGraph,
    Pane,
    PaneGrid,
    PaneSection,
    Text,
    type FlowGraphEdge,
    type FlowGraphNode,
    type FlowGraphPositions,
} from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { PaneHead } from "@/components/composites/PaneHead"

/** What the canvas draws. */
interface GraphDrawing {
    readonly nodes: ReadonlyArray<FlowGraphNode>
    readonly edges: ReadonlyArray<FlowGraphEdge>
}

/** The words, the view and the commands of the Graph tab. */
export interface AgentWorkflowGraphBaseProps {
    readonly props: {
        readonly gridLabel: string
        readonly canvasLabel: string
        readonly title: string
        readonly countLabel: string
        /** "4 running, 1 off"; empty while unread. */
        readonly statesLabel: string
        readonly openListLabel: string
        readonly listHref: string
        readonly emptyLabel: string
        readonly legend: string
        readonly placeholder: GraphDrawing
        readonly slot: DataSlot<GraphDrawing>
        readonly labels: SlotLabels
        readonly isLoading: boolean
        /** The arrangement the user dragged; empty is the automatic layout. */
        readonly positions: FlowGraphPositions
    }
    readonly on: {
        readonly retry: () => void
        /** Drag end (the moved blocks), or `{}` when the reset control returns to the automatic layout. */
        readonly move: (positions: FlowGraphPositions) => void
    }
}

/**
 * Draws the Graph tab: one full-bleed canvas pane, a title row (name, count, how many run, the way to the list) over the workflow
 * map, and the legend as a caption under it.
 */
export const AgentWorkflowGraphBase = (props: AgentWorkflowGraphBaseProps) => {
    const copy = props.props
    return (
        <PaneGrid label={copy.gridLabel} areas={{ base: ["canvas"] }} columns={{ base: ["fill"] }}>
            <Pane area="canvas" surface content="full" label={copy.canvasLabel}>
                <PaneHead
                    title={copy.title}
                    status={<Badge>{copy.countLabel}</Badge>}
                    {...(copy.statesLabel === "" ? {} : { description: copy.statesLabel })}
                    actions={
                        <Button intent="neutral" size="sm" href={copy.listHref}>
                            {copy.openListLabel}
                        </Button>
                    }
                />
                <PaneSection scroll={{ label: copy.canvasLabel, role: "region" }}>
                    <SlotView
                        slot={copy.slot}
                        placeholder={copy.placeholder}
                        labels={copy.labels}
                        onRetry={props.on.retry}
                        render={(data) => (
                            <FlowGraph
                                label={copy.canvasLabel}
                                nodes={data.nodes}
                                edges={data.edges}
                                layout="steps"
                                background="dots"
                                isEditable
                                positions={copy.positions}
                                onPositionsChange={props.on.move}
                                height="100%"
                                emptyLabel={copy.emptyLabel}
                                isLoading={copy.isLoading}
                            />
                        )}
                    />
                </PaneSection>
                <PaneSection>
                    <Text size="xs" tone="muted">
                        {copy.legend}
                    </Text>
                </PaneSection>
            </Pane>
        </PaneGrid>
    )
}
