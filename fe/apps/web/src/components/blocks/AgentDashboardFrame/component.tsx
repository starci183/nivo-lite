import type { ReactNode } from "react"
import { Badge, SurfaceListCard, Tabs } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { ConnectionsRegion } from "@/components/composites/ConnectionsRegion"
import type { ConnectionsRegionProps } from "@/components/composites/ConnectionsRegion"
import { DoneRegion } from "@/components/composites/DoneRegion"
import type { DoneRegionProps } from "@/components/composites/DoneRegion"
import { KnowledgeRegion } from "@/components/composites/KnowledgeRegion"
import type { KnowledgeRegionProps } from "@/components/composites/KnowledgeRegion"
import { SlotView } from "@/components/composites/SlotView"
import { WaitingRegion } from "@/components/composites/WaitingRegion"
import type { WaitingRegionProps } from "@/components/composites/WaitingRegion"
import type { DataSlot, SlotLabels } from "@/modules/types"
import {
    COMMAND_CLASS_NAME,
    FRAME_CLASS_NAME,
    PANEL_CLASS_NAME,
    SIDE_COLUMN_CLASS_NAME,
    SIDE_GRID_CLASS_NAME,
    TOOLBAR_CLASS_NAME,
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
    /** The waiting card of the module in place of the built-in one; null draws the dashboard waiting region. */
    readonly waiting: ReactNode
    /** The gaps card of the module after the regions; null for none. */
    readonly gaps: ReactNode
    /** Layers the module opens over the workbench, drawn after the open area; null for none. */
    readonly overlay: ReactNode
    /** The content of the open area; null shows the skeleton card while `hasPlaceholder`. */
    readonly panel: ReactNode
}

/** What the heading shows once the agent is read. */
export interface AgentDashboardHeadView {
    readonly title: string
    readonly mode: { readonly label: string; readonly tone: BadgeTone } | null
    /** The default page command, "Talk to the agent"; null while there is no agent or a module brings its own. */
    readonly chat: { readonly label: string; readonly href: string } | null
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

/** Copy, slots and data of the shared page anatomy of an agent workbench. */
export interface AgentDashboardFrameBaseProps {
    readonly shape: AgentDashboardFrameSlots
    readonly props: {
        /** The heading: a skeleton until the agent is read. */
        readonly head: DataSlot<AgentDashboardHeadView>
        readonly headPlaceholder: AgentDashboardHeadView
        readonly headLabels: SlotLabels
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
    }
}

/** Draws the workbench body for the instance Page: the mode badge and the area tabs as a toolbar, the regions and the open area below. */
export const AgentDashboardFrameBase = (props: AgentDashboardFrameBaseProps) => {
    const view = props.props
    const hasStrip = view.tabs.length > 1
    const active = view.tabs.find((tab) => tab.id === view.selectedTab)
    return (
        <div className={FRAME_CLASS_NAME}>
            <div className={TOOLBAR_CLASS_NAME}>
                <SlotView
                    slot={view.head}
                    placeholder={view.headPlaceholder}
                    labels={view.headLabels}
                    forbidden="notice"
                    onRetry={props.on.retry}
                >
                    {(head) =>
                        head.mode === null ? null : (
                            <Badge tone={head.mode.tone} isDot>
                                {head.mode.label}
                            </Badge>
                        )
                    }
                </SlotView>
                {hasStrip ? (
                    <Tabs
                        label={view.tabsLabel}
                        selectedKey={view.selectedTab}
                        inset="none"
                        labelVisibility="always"
                        items={view.tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
                        panelId={tabPanelId}
                        onSelect={props.on.selectTab}
                    />
                ) : null}
            </div>
            {props.shape.command === null ? null : <div className={COMMAND_CLASS_NAME}>{props.shape.command}</div>}

            {props.shape.ribbon}

            {props.shape.waiting ?? (
                <Region region={view.waiting} onRetry={props.on.retry}>
                    {(waiting, isSkeleton) => (
                        <WaitingRegion label={view.waiting.label} view={waiting} isSkeleton={isSkeleton} />
                    )}
                </Region>
            )}

            {renderDashboardRegions(view, props)}
            {props.shape.gaps}

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
