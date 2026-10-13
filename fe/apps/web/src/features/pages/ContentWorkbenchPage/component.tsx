import type { ReactNode } from "react"
import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"
import { ContentAddPost } from "@/components/blocks/ContentAddPost"
import { ContentAutomationCard } from "@/components/blocks/ContentAutomationCard"
import { ContentBalancePanel } from "@/components/blocks/ContentBalancePanel"
import { ContentBrandCard } from "@/components/blocks/ContentBrandCard"
import { ContentCadenceCard } from "@/components/blocks/ContentCadenceCard"
import { ContentCalendarPanel } from "@/components/blocks/ContentCalendarPanel"
import { ContentRibbon } from "@/components/blocks/ContentRibbon"
import { ContentListPanel } from "@/components/blocks/ContentListPanel"
import { ContentPillarsCard } from "@/components/blocks/ContentPillarsCard"
import { ContentPlanAction } from "@/components/blocks/ContentPlanAction"
import { ContentPostEditor } from "@/components/blocks/ContentPostEditor"
import { ContentQueuePanel } from "@/components/blocks/ContentQueuePanel"
import { ContentQuickIdea } from "@/components/blocks/ContentQuickIdea"
import { ContentReadOnlyNotice } from "@/components/blocks/ContentReadOnlyNotice"
import { ContentWorkbenchGate } from "@/components/blocks/ContentWorkbenchGate"
import { ContentWorkbenchStatus } from "@/components/blocks/ContentWorkbenchStatus"
import { PANEL_CLASS_NAME, TOOLBAR_CLASS_NAME } from "./classNames"

/** The tab names of the content workbench. */
interface ContentWorkbenchTabs {
    readonly calendar: string
    readonly list: string
    readonly queue: string
    readonly balance: string
    readonly settings: string
}

/** What the content workbench page draws. */
export interface ContentWorkbenchPageBaseProps {
    readonly props: {
        /** The agent instance the workbench opened for. */
        readonly installationId: string | null
        /** The tab named in the address. */
        readonly initialTab: string | null
        /** The post named by `?focus=`, open in the editor. */
        readonly focus: string | null
        readonly tabs: ContentWorkbenchTabs
    }
}

/** What a tab panel holds under the plan command and the status. */
interface PanelProps {
    readonly children: ReactNode
}

/** A tab panel: the plan command for a member who may manage the content, the read status, then the blocks of the tab. */
const Panel = (props: PanelProps) => (
    <div className={PANEL_CLASS_NAME}>
        <ContentWorkbenchGate requireManage>
            <ContentPlanAction />
        </ContentWorkbenchGate>
        <ContentWorkbenchStatus />
        {props.children}
    </div>
)

/** The commands above the calendar and the list, for a member who may manage the content. */
const Commands = () => (
    <ContentWorkbenchGate requireManage>
        <div className={TOOLBAR_CLASS_NAME}>
            <ContentQuickIdea />
            <ContentAddPost />
        </div>
    </ContentWorkbenchGate>
)

/** Draws the content workbench: the agent dashboard frame around the five content tabs, and the post editor when one is open. */
export const ContentWorkbenchPageBase = (props: ContentWorkbenchPageBaseProps) => {
    const { installationId, initialTab, focus, tabs } = props.props
    return (
        <>
            <AgentDashboardFrame
                module="content"
                installationId={installationId}
                initialTab={initialTab}
                ribbon={<ContentRibbon />}
                waitingTab="queue"
                tabs={[
                    {
                        id: "calendar",
                        label: tabs.calendar,
                        content: (
                            <Panel>
                                <Commands />
                                <ContentWorkbenchGate placeholder={tabs.calendar}>
                                    <ContentCalendarPanel />
                                </ContentWorkbenchGate>
                            </Panel>
                        ),
                    },
                    {
                        id: "list",
                        label: tabs.list,
                        content: (
                            <Panel>
                                <Commands />
                                <ContentWorkbenchGate placeholder={tabs.list}>
                                    <ContentListPanel />
                                </ContentWorkbenchGate>
                            </Panel>
                        ),
                    },
                    {
                        id: "queue",
                        label: tabs.queue,
                        content: (
                            <Panel>
                                <ContentWorkbenchGate placeholder={tabs.queue}>
                                    <ContentQueuePanel />
                                </ContentWorkbenchGate>
                            </Panel>
                        ),
                    },
                    {
                        id: "balance",
                        label: tabs.balance,
                        content: (
                            <Panel>
                                <ContentWorkbenchGate placeholder={tabs.balance}>
                                    <ContentBalancePanel />
                                </ContentWorkbenchGate>
                            </Panel>
                        ),
                    },
                    {
                        id: "settings",
                        label: tabs.settings,
                        content: (
                            <Panel>
                                <ContentReadOnlyNotice />
                                <ContentWorkbenchGate placeholder={tabs.settings}>
                                    <ContentPillarsCard />
                                    <ContentCadenceCard />
                                    <ContentBrandCard />
                                    <ContentAutomationCard />
                                </ContentWorkbenchGate>
                            </Panel>
                        ),
                    },
                ]}
            />
            {focus === null ? null : (
                <ContentWorkbenchGate key={focus} focus={focus}>
                    <ContentPostEditor focus={focus} />
                </ContentWorkbenchGate>
            )}
        </>
    )
}
