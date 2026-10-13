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
import { ContentReadOnlyNotice } from "@/components/blocks/ContentReadOnlyNotice"
import { ContentWorkbenchGate } from "@/components/blocks/ContentWorkbenchGate"
import { ContentWorkbenchStatus } from "@/components/blocks/ContentWorkbenchStatus"
import { WorkbenchHeader } from "@/components/blocks/WorkbenchHeader"
import { workbenchPanelId } from "@/components/leaves/WorkbenchTabsNav"
import { FRAME_CLASS_NAME, PANEL_CLASS_NAME, TOOLBAR_CLASS_NAME } from "./classNames"

/** The tabs of the content workbench, in order. */
export type ContentWorkbenchTab = "calendar" | "list" | "queue" | "balance" | "settings"

/** What the content workbench page draws. */
export interface ContentWorkbenchPageBaseProps {
    readonly props: {
        /** The agent instance the workbench opened for. */
        readonly installationId: string | null
        /** The tab named in the address. */
        readonly tab: ContentWorkbenchTab
        /** The post named by `?focus=`, open in the editor. */
        readonly focus: string | null
    }
}

/** The commands above the calendar and the list, for a member who may manage the content. */
const Commands = () => (
    <ContentWorkbenchGate requireManage>
        <div className={TOOLBAR_CLASS_NAME}>
            <ContentQuickIdea />
            <ContentAddPost />
        </div>
    </ContentWorkbenchGate>
)

/** What the panel needs to know. */
interface PanelProps {
    readonly tab: ContentWorkbenchTab
}

/** The panel of the selected tab, drawn once the workbench is read. */
const Panel = (props: PanelProps) => {
    switch (props.tab) {
        case "calendar":
            return (
                <>
                    <Commands />
                    <ContentWorkbenchGate>
                        <ContentCalendarPanel />
                    </ContentWorkbenchGate>
                </>
            )
        case "list":
            return (
                <>
                    <Commands />
                    <ContentWorkbenchGate>
                        <ContentListPanel />
                    </ContentWorkbenchGate>
                </>
            )
        case "queue":
            return (
                <ContentWorkbenchGate>
                    <ContentQueuePanel />
                </ContentWorkbenchGate>
            )
        case "balance":
            return (
                <ContentWorkbenchGate>
                    <ContentBalancePanel />
                </ContentWorkbenchGate>
            )
        case "settings":
            return (
                <>
                    <ContentReadOnlyNotice />
                    <ContentWorkbenchGate>
                        <ContentPillarsCard />
                        <ContentCadenceCard />
                        <ContentBrandCard />
                        <ContentAutomationCard />
                    </ContentWorkbenchGate>
                </>
            )
    }
}

/** Draws the content workbench: the header, the plan command, the panel of the selected tab, and the post editor when one is open. */
export const ContentWorkbenchPageBase = (props: ContentWorkbenchPageBaseProps) => {
    const { installationId, tab, focus } = props.props
    return (
        <>
            <div className={FRAME_CLASS_NAME}>
                <WorkbenchHeader module="content" installationId={installationId} tab={tab} />
                <div className={PANEL_CLASS_NAME} role="tabpanel" id={workbenchPanelId(tab)}>
                    <ContentWorkbenchGate requireManage>
                        <ContentPlanAction />
                    </ContentWorkbenchGate>
                    <ContentWorkbenchStatus />
                    <Panel tab={tab} />
                </div>
            </div>
            {focus === null ? null : (
                <ContentWorkbenchGate key={focus} focus={focus}>
                    <ContentPostEditor focus={focus} />
                </ContentWorkbenchGate>
            )}
        </>
    )
}
