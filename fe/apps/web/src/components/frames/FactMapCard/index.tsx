import { BubbleMap, Cluster, Pane, PaneGrid, StatusDot, SurfaceCard, Text } from "@starci/grammar/common"
import type { HeaderZone } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { FactMapPane } from "@/components/frames/FactMapPane"
import type { FactCardWords, FactMapView, FactMode } from "@/modules/brain"

/** The switch that opens the card's head: the same facts as a list or as a map. */
export const factModeZoneOf = (
    words: FactCardWords,
    mode: FactMode,
    onSelect: (id: string) => void,
): HeaderZone => ({
    kind: "switch",
    label: words.modeLabel,
    items: [
        { id: "list", label: words.modeList },
        { id: "map", label: words.modeMap },
    ],
    selectedKey: mode,
    onSelect,
})

/** Props for {@link FactMapCard}. */
interface FactMapCardProps {
    readonly props: {
        readonly words: FactCardWords
        readonly view: FactMapView
    }
    readonly on: {
        readonly setMode: (id: string) => void
        readonly setView: (id: string) => void
        readonly select: (id: string | null) => void
        readonly retry: () => void
        readonly approve: () => void
        readonly edit: () => void
        readonly compare: () => void
    }
}

/** The legend under the map: a dot per state of a fact, and the rectangle that marks a document. */
const Legend = (props: { readonly view: FactMapView }) => (
    <Cluster gap="row" align="center">
        {props.view.legend.map((dot) => (
            <Cluster key={dot.id} gap="inline" align="center">
                <StatusDot tone={dot.tone} aria-label={dot.label} />
                <Text size="xs" tone="muted">
                    {dot.label}
                </Text>
            </Cluster>
        ))}
        <Text size="xs" tone="muted">
            {props.view.documentLegend}
        </Text>
    </Cluster>
)

/**
 * The facts of the shop drawn as a map in the card "The shop's brain": the switch between the list and the map at the head, the
 * audience views under it, the orbit map beside its side pane, and the legend at the foot. Nodes the chosen view cannot read are dimmed.
 */
export const FactMapCard = (props: FactMapCardProps) => {
    const { view } = props.props
    const { on } = props
    return (
        <SurfaceCard
            label={props.props.words.title}
            headers={[
                factModeZoneOf(props.props.words, "map", on.setMode),
                {
                    kind: "filter",
                    label: view.viewLabel,
                    items: view.views,
                    selectedKey: view.viewId,
                    onSelect: on.setView,
                },
            ]}
            footers={[{ kind: "custom", children: <Legend view={view} /> }]}
        >
            <PaneGrid
                label={view.label}
                areas={{ base: ["map", "aside"], medium: ["map aside"] }}
                columns={{ base: ["fill"], medium: ["fill", "wide"] }}
            >
                <Pane area="map" inset="flush" label={view.label}>
                    <SlotView
                        slot={view.slot}
                        placeholder={view.placeholder}
                        labels={view.slotLabels}
                        onRetry={on.retry}
                        render={(content, isLoading) => (
                            <BubbleMap
                                label={view.label}
                                nodes={content.nodes}
                                edges={content.edges}
                                selectedId={view.selectedId}
                                onSelect={on.select}
                                emptyLabel={view.emptyLabel}
                                isLoading={isLoading}
                                height="lg"
                            />
                        )}
                    />
                </Pane>
                <Pane area="aside" surface label={view.paneLabel}>
                    <FactMapPane
                        view={view.pane}
                        emptyTitle={view.paneEmptyTitle}
                        emptyBody={view.paneEmptyBody}
                        readersNone={view.readersNone}
                        on={{ approve: on.approve, edit: on.edit, compare: on.compare }}
                    />
                </Pane>
            </PaneGrid>
        </SurfaceCard>
    )
}
