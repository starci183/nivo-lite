import { Alert, EmptyNotice, SurfaceCard, type DescriptionListStatItem } from "@starci/grammar/common"
import { ContentAddPost } from "@/components/blocks/ContentAddPost"
import { ContentAutomationCard } from "@/components/blocks/ContentAutomationCard"
import { ContentBalancePanel } from "@/components/blocks/ContentBalancePanel"
import { ContentBrandCard } from "@/components/blocks/ContentBrandCard"
import { ContentCadenceCard } from "@/components/blocks/ContentCadenceCard"
import { ContentCalendarPanel } from "@/components/blocks/ContentCalendarPanel"
import { ContentListPanel } from "@/components/blocks/ContentListPanel"
import { ContentPillarsCard } from "@/components/blocks/ContentPillarsCard"
import { ContentPlanAction } from "@/components/blocks/ContentPlanAction"
import { ContentPostEditor } from "@/components/blocks/ContentPostEditor"
import { ContentQueuePanel } from "@/components/blocks/ContentQueuePanel"
import { ContentQuickIdea } from "@/components/blocks/ContentQuickIdea"
import { AgentDashboardFrame } from "@/features/agent-dashboard"
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared"
import type { ContentItem, ContentWorkbenchData } from "@/modules/content"
import { PANEL_CLASS_NAME, TOOLBAR_CLASS_NAME } from "./classNames"

/** What the Content workbench page draws. */
export interface ContentWorkbenchPageBaseProps {
    readonly props: {
        /** The common regions of the frame (waiting, done, connections, knowledge). */
        readonly dashboard: AgentDashboardData
        /** What the workbench read for the member. */
        readonly data: ContentWorkbenchData
        /** The four figures of the ribbon; empty when they could not be read. */
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        /** The tab named in the address. */
        readonly initialTab: string | null
        /** The post named by `?focus=`, open in the editor. */
        readonly focused: ContentItem | null
        readonly labels: {
            readonly calendar: string
            readonly list: string
            readonly queue: string
            readonly balance: string
            readonly settings: string
            readonly readOnly: string
        }
    }
}

/** What the page draws when the workbench could not be read. */
export interface ContentWorkbenchFailureProps {
    readonly props: {
        readonly dashboard: AgentDashboardData
        readonly tabLabel: string
        readonly title: string
        readonly body: string
    }
}

/** Draws the Content workbench inside the agent dashboard frame, and the post editor when a post is focused. */
export const ContentWorkbenchPageBase = (props: ContentWorkbenchPageBaseProps) => {
    const { data, labels } = props.props
    const activePillars = data.pillars.filter((p) => p.active)
    const channels = data.cadence.filter((c) => c.posts_per_week > 0).map((c) => c.channel)
    const commands = data.canManage ? (
        <div className={TOOLBAR_CLASS_NAME}>
            <ContentQuickIdea defaultChannels={channels} />
            <ContentAddPost pillars={activePillars} />
        </div>
    ) : null
    const version = JSON.stringify([data.pillars, data.cadence, data.settings])
    return (
        <>
            <AgentDashboardFrame
                module="content"
                data={props.props.dashboard}
                figures={props.props.figures}
                figuresFailed={data.figures === null}
                command={
                    data.canManage ? <ContentPlanAction nowIso={data.nowIso} lastPlan={data.lastPlan} /> : undefined
                }
                initialTab={props.props.initialTab}
                tabs={[
                    {
                        id: "calendar",
                        label: labels.calendar,
                        content: (
                            <div className={PANEL_CLASS_NAME}>
                                {commands}
                                <ContentCalendarPanel data={data} />
                            </div>
                        ),
                    },
                    {
                        id: "list",
                        label: labels.list,
                        content: (
                            <div className={PANEL_CLASS_NAME}>
                                {commands}
                                <ContentListPanel data={data} />
                            </div>
                        ),
                    },
                    { id: "queue", label: labels.queue, content: <ContentQueuePanel data={data} /> },
                    { id: "balance", label: labels.balance, content: <ContentBalancePanel data={data} /> },
                    {
                        id: "settings",
                        label: labels.settings,
                        content: (
                            <div className={PANEL_CLASS_NAME}>
                                {data.canManage ? null : <Alert title={labels.readOnly} tone="informative" />}
                                <ContentPillarsCard
                                    key={`p:${version}`}
                                    pillars={data.pillars}
                                    canManage={data.canManage}
                                />
                                <ContentCadenceCard
                                    key={`c:${version}`}
                                    cadence={data.cadence}
                                    canManage={data.canManage}
                                />
                                <ContentBrandCard
                                    key={`b:${version}`}
                                    settings={data.settings}
                                    canManage={data.canManage}
                                />
                                <ContentAutomationCard
                                    key={`a:${version}`}
                                    settings={data.settings}
                                    canManage={data.canManage}
                                />
                            </div>
                        ),
                    },
                ]}
            />
            {props.props.focused ? (
                <ContentPostEditor
                    key={`${props.props.focused.id}:${props.props.focused.status}:${props.props.focused.updated_at}`}
                    item={props.props.focused}
                    data={data}
                />
            ) : null}
        </>
    )
}

/** Draws the frame with one failed region when the workbench data could not be read. */
export const ContentWorkbenchFailure = (props: ContentWorkbenchFailureProps) => (
    <AgentDashboardFrame
        module="content"
        data={props.props.dashboard}
        figures={[]}
        figuresFailed
        tabs={[
            {
                id: "calendar",
                label: props.props.tabLabel,
                content: (
                    <SurfaceCard ariaLabel={props.props.title}>
                        <EmptyNotice message={props.props.title} description={props.props.body} />
                    </SurfaceCard>
                ),
            },
        ]}
    />
)
