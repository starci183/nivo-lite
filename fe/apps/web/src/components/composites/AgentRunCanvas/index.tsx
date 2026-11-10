import { Badge, Cluster, FlowGraph, FlowGraphLegend, Link, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { RunCanvasView } from "@/modules/types"

/** What the map card of a run draws and what it does. */
interface AgentRunCanvasProps {
    readonly props: {
        readonly title: string
        /** The version of the workflow, as the fact beside the title; empty for none. */
        readonly fact: string
        readonly openLabel: string
        /** Where the workflow opens; empty draws no link. */
        readonly openHref: string
        readonly note: string
        readonly emptyLabel: string
        readonly canvas: RunCanvasView
        readonly isLoading: boolean
    }
    readonly on: {
        readonly select: (nodeKey: string) => void
    }
}

/**
 * The card map of a run in a card: the graph the run ran on as white step cards with the run overlay (a status ring and badge per
 * card, the cards it never reached faded, the edges it took solid); under the card the kind legend, the status key and the
 * caption. Pressing a card selects its step and opens the settings it ran with.
 */
export const AgentRunCanvas = (props: AgentRunCanvasProps) => {
    const { canvas } = props.props
    return (
        <SurfaceCard
            label={props.props.title}
            {...(props.props.fact === "" ? {} : { fact: props.props.fact })}
            {...(props.props.openHref === ""
                ? {}
                : {
                      labelEnd: (
                          <Link variant="head" href={props.props.openHref}>
                              {props.props.openLabel}
                          </Link>
                      ),
                  })}
            headingLevel={2}
            note={
                <Stack gap="identity">
                    <FlowGraphLegend items={canvas.kinds} />
                    <Cluster gap="inline">
                        {canvas.legend.map((item) => (
                            <Badge key={item.id} tone={item.tone}>
                                {item.label}
                            </Badge>
                        ))}
                    </Cluster>
                    <Text size="sm" tone="muted">
                        {props.props.note}
                    </Text>
                </Stack>
            }
            isLoading={props.props.isLoading}
        >
            <FlowGraph
                label={props.props.title}
                nodes={canvas.nodes}
                edges={canvas.edges}
                layout="steps"
                fit="readable"
                showControls
                statusLabels={canvas.statusLabels}
                emptyLabel={props.props.emptyLabel}
                isLoading={props.props.isLoading}
                selectedId={canvas.selectedId}
                onNodePress={props.on.select}
            />
        </SurfaceCard>
    )
}
