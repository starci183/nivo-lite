import type { ReactNode } from "react"
import {
    Badge,
    Button,
    FlowGraph,
    ListRow,
    Page,
    Pane,
    PaneGrid,
    PaneSection,
    SectionHeader,
    Select,
    SurfaceListCard,
    Text,
    TextAction,
} from "@starci/grammar/common"
import type { BadgeTone, FlowGraphEdge, FlowGraphNode, PageHeaderContent } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { BADGES_CLASS_NAME, DETAIL_CLASS_NAME, MAP_CLASS_NAME } from "./classNames"

/** The nodes and edges the map draws. */
export interface MapContent {
    readonly nodes: ReadonlyArray<FlowGraphNode>
    readonly edges: ReadonlyArray<FlowGraphEdge>
}

/** One row of the selected node's list: a dossier of the category, or a status with its count. */
export interface MapRowView {
    readonly id: string
    readonly label: string
    readonly description: string | null
    /** Where the row leads (the map with that node selected); null where the row is only a figure. */
    readonly href: string | null
    readonly badge: { readonly label: string; readonly tone: BadgeTone } | null
}

/** What the side pane says about the selected node (or about the whole map when nothing is selected). */
export interface MapDetailView {
    readonly title: string
    readonly badges: ReadonlyArray<{ readonly id: string; readonly label: string; readonly tone: BadgeTone }>
    readonly lines: ReadonlyArray<string>
    readonly rowsLabel: string
    readonly rows: ReadonlyArray<MapRowView>
    /** The way to the dossier itself; null for a node that is not a dossier. */
    readonly action: { readonly label: string; readonly href: string } | null
}

/** Copy and values the map supplies. */
export interface BrainMapBaseProps {
    /** The findings of the selected dossier, when a dossier is selected. */
    readonly shape: { readonly findings: ReactNode }
    readonly props: {
        /** The Second Brain header with its tabs: the grid attaches flush under the tab line. */
        readonly header: PageHeaderContent
        /** The id of the map tab panel, which the grid is. */
        readonly panelId: string
        readonly gridLabel: string
        readonly mapLabel: string
        readonly emptyLabel: string
        readonly detailLabel: string
        readonly detailCloseLabel: string
        readonly isDetailOpen: boolean
        readonly filterLabel: string
        readonly filters: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly filter: string
        readonly selectedId: string | null
        readonly slot: DataSlot<MapContent>
        readonly placeholder: MapContent
        readonly slotLabels: SlotLabels
        readonly detail: MapDetailView
    }
    readonly on: {
        readonly select: (id: string | null) => void
        readonly setFilter: (value: string | null) => void
        readonly retry: () => void
        readonly detailOpenChange: (isOpen: boolean) => void
    }
}

/** What the graph says and reports. */
interface GraphProps {
    readonly label: string
    readonly emptyLabel: string
    readonly content: MapContent
    readonly selectedId: string | null
    readonly isSkeleton: boolean
    readonly onSelect: (id: string | null) => void
}

/** The graph in the map pane: the radial layout, its centre the workspace, selection reported through the address. */
const Graph = (props: GraphProps) => (
    <FlowGraph
        label={props.label}
        nodes={props.content.nodes}
        edges={props.content.edges}
        layout="radial"
        selectedId={props.selectedId}
        onSelect={props.onSelect}
        emptyLabel={props.emptyLabel}
        isLoading={props.isSkeleton}
        height="lg"
    />
)

/** The rows of the selected node: the dossiers of a category, or the dossiers at each status. */
const Rows = (props: Pick<MapDetailView, "rows" | "rowsLabel">) =>
    props.rows.length === 0 ? null : (
        <SurfaceListCard ariaLabel={props.rowsLabel}>
            {props.rows.map((row) => (
                <ListRow
                    key={row.id}
                    title={row.href === null ? row.label : <TextAction href={row.href}>{row.label}</TextAction>}
                    description={row.description}
                    badges={row.badge === null ? undefined : <Badge tone={row.badge.tone}>{row.badge.label}</Badge>}
                />
            ))}
        </SurfaceListCard>
    )

/** The selected node and the findings of its dossier. */
interface DetailProps {
    readonly detail: MapDetailView
    readonly findings: ReactNode
}

/** What the side pane draws: the node's heading, its badges and lines, its rows and the way to its dossier, then the findings. */
const Detail = (props: DetailProps) => {
    const detail = props.detail
    return (
        <div className={DETAIL_CLASS_NAME}>
            <SectionHeader level={2} title={detail.title} />
            {detail.badges.length === 0 ? null : (
                <div className={BADGES_CLASS_NAME}>
                    {detail.badges.map((badge) => (
                        <Badge key={badge.id} tone={badge.tone}>
                            {badge.label}
                        </Badge>
                    ))}
                </div>
            )}
            {detail.lines.map((line) => (
                <Text key={line} tone="muted">
                    {line}
                </Text>
            ))}
            {detail.action === null ? null : (
                <Button intent="neutral" href={detail.action.href}>
                    {detail.action.label}
                </Button>
            )}
            <Rows rows={detail.rows} rowsLabel={detail.rowsLabel} />
            {props.findings}
        </div>
    )
}

/**
 * Draws the map tab of the Second Brain as a panes page: the header with its tabs, then a PaneGrid attached under the tab
 * line. The map pane holds the status filter over a radial FlowGraph (the workspace in the centre, its categories on the
 * first ring, their dossiers toned by status on the second); the side pane shows the selected node and is a drawer on a phone.
 */
export const BrainMapBase = (props: BrainMapBaseProps) => {
    const view = props.props
    return (
        <Page chrome="panes" header={view.header} measure="product">
            <PaneGrid
                label={view.gridLabel}
                role="tabpanel"
                id={view.panelId}
                areas={{ base: ["map"], medium: ["map detail"] }}
                columns={{ base: ["fill"], medium: ["fill", "wide"] }}
                rows={{ base: ["fill"], medium: ["fill"] }}
            >
                <Pane area="map" scroll label={view.mapLabel}>
                    <PaneSection gap="section">
                        <div className={MAP_CLASS_NAME}>
                            <Select
                                label={view.filterLabel}
                                options={view.filters}
                                value={view.filter}
                                onValueChange={props.on.setFilter}
                            />
                            <SlotView
                                slot={view.slot}
                                placeholder={view.placeholder}
                                labels={view.slotLabels}
                                onRetry={props.on.retry}
                            >
                                {(content, isSkeleton) => (
                                    <Graph
                                        label={view.mapLabel}
                                        emptyLabel={view.emptyLabel}
                                        content={content}
                                        selectedId={view.selectedId}
                                        isSkeleton={isSkeleton}
                                        onSelect={props.on.select}
                                    />
                                )}
                            </SlotView>
                        </div>
                    </PaneSection>
                </Pane>
                <Pane
                    area="detail"
                    surface
                    scroll
                    label={view.detailLabel}
                    collapse="drawer"
                    collapseLabel={view.detailLabel}
                    openLabel={view.detailLabel}
                    closeLabel={view.detailCloseLabel}
                    isOpen={view.isDetailOpen}
                    onOpenChange={props.on.detailOpenChange}
                >
                    <PaneSection>
                        <Detail detail={view.detail} findings={props.shape.findings} />
                    </PaneSection>
                </Pane>
            </PaneGrid>
        </Page>
    )
}
