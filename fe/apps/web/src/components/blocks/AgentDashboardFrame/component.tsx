import type { ReactNode } from "react"
import { Badge, Button, SectionHeader, SurfaceListCard, Tabs } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { ConnectionsRegion } from "@/components/composites/ConnectionsRegion"
import type { ConnectionsRegionProps } from "@/components/composites/ConnectionsRegion"
import { DoneRegion } from "@/components/composites/DoneRegion"
import type { DoneRegionProps } from "@/components/composites/DoneRegion"
import { KnowledgeRegion } from "@/components/composites/KnowledgeRegion"
import type { KnowledgeRegionProps } from "@/components/composites/KnowledgeRegion"
import type { RegionFailure } from "@/components/branches/RegionState"
import { WaitingRegion } from "@/components/composites/WaitingRegion"
import type { WaitingRegionProps } from "@/components/composites/WaitingRegion"
import {
    COMMAND_CLASS_NAME,
    FRAME_CLASS_NAME,
    HEAD_CLASS_NAME,
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

/** The module's own pieces the frame places: its page command, its gaps card and the content of the open area. */
interface AgentDashboardFrameSlots {
    /** The module's own page command under the heading; null for none. */
    readonly command: ReactNode
    /** The module's own figures block (the ribbon under the heading); null for none. */
    readonly ribbon: ReactNode
    /** The module's own waiting card in place of the built-in one; null draws the dashboard's waiting region. */
    readonly waiting: ReactNode
    /** The module's own gaps card after the regions; null for none. */
    readonly gaps: ReactNode
    /** The content of the open area; null shows the skeleton card while `hasPlaceholder`. */
    readonly panel: ReactNode
}

/** Copy and state of the shared page anatomy of an agent workbench. */
export interface AgentDashboardFrameBaseProps {
    readonly state: AgentDashboardFrameSlots
    readonly props: {
        readonly title: string
        /** The agent is not known yet: the heading and the regions are skeletons. */
        readonly isHeadLoading: boolean
        /** The module's own tab content is not known yet: a tab without content shows a skeleton card. */
        readonly hasPlaceholder: boolean
        readonly mode: { readonly label: string; readonly tone: BadgeTone } | null
        /** The default page command, "Talk to the agent"; null while there is no agent or a module brings its own. */
        readonly chat: { readonly label: string; readonly href: string } | null
        readonly failure: RegionFailure
        readonly waiting: WaitingRegionProps["view"]
        readonly waitingFailed: boolean
        readonly waitingLabel: string
        readonly done: DoneRegionProps["view"]
        readonly doneFailed: boolean
        readonly doneLabel: string
        readonly connections: ConnectionsRegionProps["view"]
        readonly connectionsFailed: boolean
        readonly connectionsLabel: string
        readonly knowledge: KnowledgeRegionProps["view"]
        readonly knowledgeFailed: boolean
        readonly knowledgeLabel: string
        readonly tabsLabel: string
        readonly tabs: ReadonlyArray<AgentDashboardTabView>
        readonly selectedTab: string
    }
    readonly on: {
        readonly selectTab: (id: string) => void
        readonly retry: () => void
    }
}

/** Draws the anatomy of an agent workbench: header, ribbon, what waits, what was done, connections, knowledge and the module's areas. */
export const AgentDashboardFrameBase = (props: AgentDashboardFrameBaseProps) => {
    const view = props.props
    const hasStrip = view.tabs.length > 1
    const active = view.tabs.find((tab) => tab.id === view.selectedTab)
    return (
        <div className={FRAME_CLASS_NAME}>
            <div className={HEAD_CLASS_NAME}>
                <SectionHeader
                    level={2}
                    title={view.title}
                    isSkeleton={view.isHeadLoading}
                    meta={
                        view.mode === null ? undefined : (
                            <Badge tone={view.mode.tone} isDot>
                                {view.mode.label}
                            </Badge>
                        )
                    }
                    action={
                        view.chat === null ? undefined : (
                            <Button variant="primary" href={view.chat.href}>
                                {view.chat.label}
                            </Button>
                        )
                    }
                />
            </div>
            {props.state.command === null ? null : <div className={COMMAND_CLASS_NAME}>{props.state.command}</div>}

            {props.state.ribbon}

            {props.state.waiting ?? (
                <WaitingRegion
                    label={view.waitingLabel}
                    isLoading={view.isHeadLoading}
                    isFailed={view.waitingFailed}
                    view={view.waiting}
                    failure={view.failure}
                    onRetry={props.on.retry}
                />
            )}

            <div className={SIDE_GRID_CLASS_NAME}>
                <DoneRegion
                    label={view.doneLabel}
                    isLoading={view.isHeadLoading}
                    isFailed={view.doneFailed}
                    view={view.done}
                    failure={view.failure}
                    onRetry={props.on.retry}
                />
                <ConnectionsRegion
                    label={view.connectionsLabel}
                    isLoading={view.isHeadLoading}
                    isFailed={view.connectionsFailed}
                    view={view.connections}
                    failure={view.failure}
                    onRetry={props.on.retry}
                />
                <div className={SIDE_COLUMN_CLASS_NAME}>
                    <KnowledgeRegion
                        label={view.knowledgeLabel}
                        isLoading={view.isHeadLoading}
                        isFailed={view.knowledgeFailed}
                        view={view.knowledge}
                        failure={view.failure}
                        onRetry={props.on.retry}
                    />
                </div>
            </div>
            {props.state.gaps}

            {hasStrip ? (
                <Tabs
                    variant="primary"
                    label={view.tabsLabel}
                    selectedKey={view.selectedTab}
                    items={view.tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
                    inset="none"
                    labelVisibility="always"
                    panelId={tabPanelId}
                    onSelect={props.on.selectTab}
                />
            ) : null}
            <div
                className={PANEL_CLASS_NAME}
                role={hasStrip ? "tabpanel" : undefined}
                id={hasStrip ? tabPanelId(view.selectedTab) : undefined}
            >
                {props.state.panel ??
                    (view.hasPlaceholder ? (
                        <SurfaceListCard ariaLabel={active?.label ?? view.tabsLabel} isLoading />
                    ) : null)}
            </div>
        </div>
    )
}
