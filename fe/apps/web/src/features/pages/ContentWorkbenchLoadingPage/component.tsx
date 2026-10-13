import type { DescriptionListStatItem } from "@starci/grammar/common"
import { AgentDashboardFrame, type AgentDashboardTab } from "@/features/agent-dashboard"

/** What the loading view draws. */
export interface ContentWorkbenchLoadingPageBaseProps {
    readonly props: {
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        readonly tabs: ReadonlyArray<AgentDashboardTab>
    }
}

/** Draws the Content workbench frame in its loading state. */
export const ContentWorkbenchLoadingPageBase = (props: ContentWorkbenchLoadingPageBaseProps) => (
    <AgentDashboardFrame module="content" isLoading figures={props.props.figures} tabs={props.props.tabs} />
)
