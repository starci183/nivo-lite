import type { ReactNode } from "react"
import { Button, ListRow, Pane, PaneGrid, PaneSection, SurfaceListCard, Tabs } from "@starci/grammar/common"
import { ConnectionsRegion } from "@/components/composites/ConnectionsRegion"
import type { ConnectionsRegionProps } from "@/components/composites/ConnectionsRegion"
import { DoneRegion } from "@/components/composites/DoneRegion"
import type { DoneRegionProps } from "@/components/composites/DoneRegion"
import { KnowledgeRegion } from "@/components/composites/KnowledgeRegion"
import type { KnowledgeRegionProps } from "@/components/composites/KnowledgeRegion"
import { SlotView } from "@/components/composites/SlotView"
import { WaitingRegion } from "@/components/composites/WaitingRegion"
import type { WaitingRegionProps } from "@/components/composites/WaitingRegion"
import { WorkbenchStatusBand } from "@/components/composites/WorkbenchStatusBand"
import { WorkbenchWhy } from "@/components/composites/WorkbenchWhy"
import type { WorkbenchWhyLabels } from "@/components/composites/WorkbenchWhy"
import type { DataSlot, SlotLabels, WorkbenchBandView, WorkbenchSurface, WorkbenchWhyView } from "@/modules/types"
import {
    COMMAND_CLASS_NAME,
    FRAME_CLASS_NAME,
    PANE_LIST_CLASS_NAME,
    PANEL_CLASS_NAME,
    SIDE_COLUMN_CLASS_NAME,
    SIDE_GRID_CLASS_NAME,
} from "./classNames"

/** One area of the module under the strip: the strip draws its label, the content is placed through the slots. */
interface AgentDashboardTabView {
    readonly id: string
    readonly label: string
}

const tabPanelId = (id: string): string => `agent-dashboard-panel-${id}`

/** The module own pieces the frame places: its page command, its gaps card and the content of the open area. */
interface AgentDashboardFrameSlots {
    /** The page command of the module under the heading; null for none. */
    readonly command: ReactNode
    /** The figures block of the module (the ribbon under the heading); null for none. */
    readonly ribbon: ReactNode
    /** The waiting card of the module in place of the built-in one, drawn for the surface it stands on; null draws the dashboard waiting region. */
    readonly waiting: ((surface: WorkbenchSurface) => ReactNode) | ReactNode
    /** The decision of one work item for the footer of the why pane, the same mutation as its row; null draws no decision. */
    readonly whyDecision: ((workItemId: string) => ReactNode) | null
    /** The gaps card of the module after the regions; null for none. */
    readonly gaps: ReactNode
    /** Layers the module opens over the workbench, drawn after the open area; null for none. */
    readonly overlay: ReactNode
    /** The content of the open area; null shows the skeleton card while `hasPlaceholder`. */
    readonly panel: ReactNode
}

/** One region of the dashboard: its card label, its slot, the same-shape placeholder and the words of its status. */
interface RegionSlot<V> {
    readonly label: string
    readonly slot: DataSlot<V>
    readonly placeholder: V
    readonly labels: SlotLabels
}

/** What a region needs to be drawn through SlotView. */
interface RegionProps<V> {
    readonly region: RegionSlot<V>
    readonly onRetry: () => void
    readonly children: (view: V, isSkeleton: boolean) => ReactNode
}

/** One region drawn through SlotView: loading draws the placeholder as a skeleton, failing says so with a retry. */
const Region = <V,>(props: RegionProps<V>) => (
    <SlotView
        slot={props.region.slot}
        placeholder={props.region.placeholder}
        labels={props.region.labels}
        onRetry={props.onRetry}
    >
        {props.children}
    </SlotView>
)

/** The why pane of one work item, beside the list. */
interface WhyState {
    readonly workItemId: string | null
    /** The recorded path of the decision; null when none is recorded. */
    readonly view: WorkbenchWhyView | null
    readonly labels: WorkbenchWhyLabels
    readonly paneLabel: string
    readonly listLabel: string
    readonly openLabel: string
    readonly closeLabel: string
}

/** Copy, slots and data of the shared page anatomy of an agent workbench. */
export interface AgentDashboardFrameBaseProps {
    readonly shape: AgentDashboardFrameSlots
    readonly props: {
        /** The status band: the state, mode, version, last activity and channels; a skeleton until they are read. */
        readonly band: RegionSlot<WorkbenchBandView>
        /** The why pane: the work item it is open on (`?why=`), null when closed. */
        readonly why: WhyState
        /** The own tab content of the module is not known yet: a tab without content shows a skeleton card. */
        readonly hasPlaceholder: boolean
        readonly waiting: RegionSlot<WaitingRegionProps["view"]>
        readonly done: RegionSlot<DoneRegionProps["view"]>
        readonly connections: RegionSlot<ConnectionsRegionProps["view"]>
        readonly knowledge: RegionSlot<KnowledgeRegionProps["view"]>
        readonly tabsLabel: string
        readonly tabs: ReadonlyArray<AgentDashboardTabView>
        readonly selectedTab: string
    }
    readonly on: {
        readonly selectTab: (id: string) => void
        readonly retry: () => void
        readonly closeWhy: () => void
    }
}

/** The rows of a region as an app-owned list, for a pane: a card never stands inside a pane (pane-grid.choose.frame:cards). */
const PaneRows = (props: {
    readonly label: string
    readonly rows: WaitingRegionProps["view"]["rows"]
    readonly openLabel: string | null
    readonly isSkeleton: boolean
}) => (
    <ul className={PANE_LIST_CLASS_NAME} aria-label={props.label}>
        {props.rows.map((row) => (
            <ListRow
                key={row.id}
                isSkeleton={props.isSkeleton}
                title={row.title}
                description={row.description}
                actions={
                    props.openLabel === null ? undefined : (
                        <Button size="sm" intent="neutral" href={row.href} isSkeleton={props.isSkeleton}>
                            {props.openLabel}
                        </Button>
                    )
                }
            />
        ))}
    </ul>
)

/** The waiting card of the module for a surface; a module without its own draws the dashboard's. */
const renderWaiting = (base: AgentDashboardFrameBaseProps, surface: WorkbenchSurface) => {
    const view = base.props
    const own = base.shape.waiting
    if (typeof own === "function") return own(surface)
    if (surface === "card") {
        return (
            own ?? (
                <Region region={view.waiting} onRetry={base.on.retry}>
                    {(waiting, isSkeleton) => (
                        <WaitingRegion label={view.waiting.label} view={waiting} isSkeleton={isSkeleton} />
                    )}
                </Region>
            )
        )
    }
    return (
        <Region region={view.waiting} onRetry={base.on.retry}>
            {(waiting, isSkeleton) => (
                <PaneRows
                    label={view.waiting.label}
                    rows={waiting.rows}
                    openLabel={waiting.openLabel}
                    isSkeleton={isSkeleton}
                />
            )}
        </Region>
    )
}

/**
 * With `?why=` the body is two panes (pane-grid.choose.page:nested): the waiting rows and Done as app-owned lists, and the why of
 * one item beside them; on a phone the why pane is a drawer over the list. The band, the figures and the tabs do not draw.
 */
const renderWhyPanes = (base: AgentDashboardFrameBaseProps, why: WhyState, workItemId: string) => {
    const view = base.props
    return (
        <PaneGrid
            label={why.paneLabel}
            areas={{ base: ["list"], medium: ["list why"] }}
            columns={{ base: ["fill"], medium: ["fill", "wide"] }}
        >
            <Pane area="list" scroll label={why.listLabel}>
                <PaneSection grow>
                    {renderWaiting(base, "pane")}
                    <Region region={view.done} onRetry={base.on.retry}>
                        {(done, isSkeleton) => (
                            <PaneRows label={view.done.label} rows={done.rows} openLabel={null} isSkeleton={isSkeleton} />
                        )}
                    </Region>
                </PaneSection>
            </Pane>
            <Pane
                area="why"
                scroll
                label={why.paneLabel}
                collapse="drawer"
                collapseLabel={why.paneLabel}
                openLabel={why.openLabel}
                closeLabel={why.closeLabel}
                isOpen
                onOpenChange={(isOpen) => {
                    if (!isOpen) base.on.closeWhy()
                }}
            >
                <WorkbenchWhy
                    view={why.view}
                    labels={why.labels}
                    decision={base.shape.whyDecision === null ? null : base.shape.whyDecision(workItemId)}
                    isSkeleton={false}
                />
            </Pane>
        </PaneGrid>
    )
}

/**
 * Draws the workbench body for the instance Page, top to bottom: the status band, what waits for a person, the figures, the
 * module's areas as tabs with the open one, then done, connections and knowledge (workbench section 3).
 */
export const AgentDashboardFrameBase = (props: AgentDashboardFrameBaseProps) => {
    const view = props.props
    if (view.why.workItemId !== null) return renderWhyPanes(props, view.why, view.why.workItemId)
    const hasStrip = view.tabs.length > 1
    const active = view.tabs.find((tab) => tab.id === view.selectedTab)
    return (
        <div className={FRAME_CLASS_NAME}>
            {props.shape.command === null ? null : <div className={COMMAND_CLASS_NAME}>{props.shape.command}</div>}

            <Region region={view.band} onRetry={props.on.retry}>
                {(band, isSkeleton) => (
                    <WorkbenchStatusBand label={view.band.label} view={band} isSkeleton={isSkeleton} />
                )}
            </Region>

            {renderWaiting(props, "card")}

            {props.shape.ribbon}

            {hasStrip ? (
                <Tabs
                    variant="secondary"
                    label={view.tabsLabel}
                    selectedKey={view.selectedTab}
                    inset="none"
                    labelVisibility="always"
                    items={view.tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
                    panelId={tabPanelId}
                    onSelect={props.on.selectTab}
                />
            ) : null}
            <div
                className={PANEL_CLASS_NAME}
                role={hasStrip ? "tabpanel" : undefined}
                id={hasStrip ? tabPanelId(view.selectedTab) : undefined}
            >
                {props.shape.panel ??
                    (view.hasPlaceholder ? (
                        <SurfaceListCard ariaLabel={active?.label ?? view.tabsLabel} isLoading />
                    ) : null)}
            </div>

            {renderDashboardRegions(view, props)}
            {props.shape.gaps}
            {props.shape.overlay}
        </div>
    )
}

/** Draws the div section of the AgentDashboardFrame view. */
const renderDashboardRegions = (view: AgentDashboardFrameBaseProps["props"], props: AgentDashboardFrameBaseProps) => {
    return (
        <div className={SIDE_GRID_CLASS_NAME}>
            <Region region={view.done} onRetry={props.on.retry}>
                {(done, isSkeleton) => <DoneRegion label={view.done.label} view={done} isSkeleton={isSkeleton} />}
            </Region>
            <Region region={view.connections} onRetry={props.on.retry}>
                {(connections, isSkeleton) => (
                    <ConnectionsRegion label={view.connections.label} view={connections} isSkeleton={isSkeleton} />
                )}
            </Region>
            <div className={SIDE_COLUMN_CLASS_NAME}>
                <Region region={view.knowledge} onRetry={props.on.retry}>
                    {(knowledge, isSkeleton) => (
                        <KnowledgeRegion label={view.knowledge.label} view={knowledge} isSkeleton={isSkeleton} />
                    )}
                </Region>
            </div>
        </div>
    )
}
