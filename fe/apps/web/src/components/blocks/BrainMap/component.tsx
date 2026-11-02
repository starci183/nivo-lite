import type { ReactNode } from "react"
import {
    Badge,
    Button,
    Cluster,
    EmptyNotice,
    Page,
    Pane,
    PaneGrid,
    PaneSection,
    Select,
    Text,
    Section,
    BubbleMap,
    type BadgeTone,
    type BubbleMapEdge,
    type BubbleMapNode,
} from "@starci/grammar/common"

import { SlotView } from "@/components/composites/SlotView"
import { BrainPageActions } from "@/components/composites/BrainPageActions"
import type { BrainPageHeaderView, DataSlot, SlotLabels } from "@/modules/types"

/** The nodes and edges the map draws. */
export interface MapContent {
    readonly nodes: ReadonlyArray<BubbleMapNode>
    readonly edges: ReadonlyArray<BubbleMapEdge>
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
    readonly children: ReactNode
    readonly props: {
        /** The Second Brain header with its tabs: the grid attaches flush under the tab line. */
        readonly header: BrainPageHeaderView
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
        readonly reviewAll: () => void
        readonly setPart: (id: string) => void
        readonly selectTab: (id: string) => void
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
    readonly isLoading: boolean
    readonly onSelect: (id: string | null) => void
}

/** The graph in the map pane: the orbit layout, its centre the workspace, selection reported through the address. */
const Graph = (props: GraphProps) => (
    <BubbleMap
        label={props.label}
        nodes={props.content.nodes}
        edges={props.content.edges}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
        emptyLabel={props.emptyLabel}
        isLoading={props.isLoading}
        height="lg"
    />
)

/** The rows of the selected node: the dossiers of a category, or the dossiers at each status. */
const Rows = (props: Pick<MapDetailView, "rows" | "rowsLabel">) =>
    props.rows.length === 0 ? null : (
        <Section
            kind="list"
            title={props.rowsLabel}
            headingLevel={3}
            items={props.rows.map((row) => {
                const description = row.description ?? undefined
                return {
                    id: row.id,
                    title: row.label,
                    ...(description === undefined ? {} : { description }),
                    ...(row.badge === null
                        ? {}
                        : { badges: [{ label: row.badge.label, tone: row.badge.tone }] as const }),
                    ...(row.href === null ? {} : { action: { label: row.label, href: row.href } }),
                }
            })}
            empty={<EmptyNotice message={props.rowsLabel} />}
        />
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
        <Section title={detail.title}>
            {detail.badges.length === 0 ? null : (
                <Cluster gap="inline">
                    {detail.badges.map((badge) => (
                        <Badge key={badge.id} tone={badge.tone}>
                            {badge.label}
                        </Badge>
                    ))}
                </Cluster>
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
        </Section>
    )
}

/**
 * Draws the map tab of the Second Brain as a panes page: the header with its tabs, then a PaneGrid attached under the tab
 * line. The map pane holds the status filter over an orbit FlowGraph (the workspace in the centre, its categories sized by
 * their documents and ringed by status, their dossiers painted by status, a dossier's documents while it is open); the side
 * pane shows the selected node and is a drawer on a phone.
 */
export const BrainMapBase = (props: BrainMapBaseProps) => {
    const view = props.props
    return (
        <Page
            chrome="panes"
            header={{
                ...view.header.heading,
                actions: (
                    <BrainPageActions
                        {...view.header.actions}
                        onReview={props.on.reviewAll}
                        onSetPart={props.on.setPart}
                    />
                ),
                tabs: {
                    label: view.header.tabs.label,
                    items: view.header.tabs.items,
                    selectedKey: view.header.tabs.selectedKey,
                    labelVisibility: "always",
                    panelId: (key) => `${view.header.tabs.panelPrefix}${key}`,
                    onSelect: props.on.selectTab,
                },
            }}
            measure="product"
        >
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
                            render={(content, isLoading) => (
                                <Graph
                                    label={view.mapLabel}
                                    emptyLabel={view.emptyLabel}
                                    content={content}
                                    selectedId={view.selectedId}
                                    isLoading={isLoading}
                                    onSelect={props.on.select}
                                />
                            )}
                        />
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
                    <PaneSection gap="section">
                        <Detail detail={view.detail} findings={props.children} />
                    </PaneSection>
                </Pane>
            </PaneGrid>
        </Page>
    )
}
