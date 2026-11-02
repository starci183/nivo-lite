import { useAgentDashboardFrame, useAgentWorkbenchTabs } from "@/hooks/agentDashboard"
import { LOYALTY_TABS } from "@/hooks/loyalty"
import type { LoyaltyTab, LoyaltyPanelInput } from "@/hooks/loyalty"
import { useQueryLoyaltyBoardSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useLoyaltyFiguresView } from "./useLoyaltyFiguresView"
import { useLoyaltyOverviewView } from "./useLoyaltyOverviewView"
import { useLoyaltyMembersView } from "./useLoyaltyMembersView"
import { useLoyaltyRewardsView } from "./useLoyaltyRewardsView"
import { useLoyaltyPromoView } from "./useLoyaltyPromoView"
import { useLoyaltyPendingView } from "./useLoyaltyPendingView"

/** Server-resolved route identity and the five actual tab labels. */
interface LoyaltyWorkbenchInput {
    readonly installationId: string
    readonly initialTab: string | null
    readonly tabs: Readonly<Record<LoyaltyTab, string>>
}

/** Owns the shared dashboard, one board read and the actual conditional panel sessions. */
export const useLoyaltyWorkbenchView = (input: LoyaltyWorkbenchInput) => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const scope = JSON.stringify([activeWorkspaceId, input.installationId])
    const tabs = useAgentWorkbenchTabs({ ids: LOYALTY_TABS, initialTab: input.initialTab, scope })
    const dashboard = useAgentDashboardFrame({
        module: "loyalty",
        installationId: input.installationId,
        hasOwnGaps: false,
    })
    const isNormal = dashboard.why.workItemId === null
    const read = useQueryLoyaltyBoardSwr(isNormal)
    const panel = (id: LoyaltyTab): LoyaltyPanelInput => ({
        read,
        workspaceId: activeWorkspaceId,
        scope,
        isActive: isNormal && tabs.selected === id,
        isReady: read.data !== undefined,
    })
    const figures = useLoyaltyFiguresView({ ...panel("overview"), isActive: isNormal })
    const overview = useLoyaltyOverviewView(panel("overview"))
    const members = useLoyaltyMembersView(panel("members"))
    const rewards = useLoyaltyRewardsView(panel("rewards"))
    const promo = useLoyaltyPromoView(panel("promo"))
    const pending = useLoyaltyPendingView(panel("pending"))
    const selectedShape = tabs.selected === "pending" ? ("decisions" as const) : tabs.selected
    return {
        shape: isNormal ? selectedShape : ("explanation" as const),
        props: {
            why: { ...dashboard.why, label: dashboard.why.paneLabel },
            regions: dashboard.regions,
            tabsLabel: dashboard.tabsLabel,
            selectedTab: tabs.selected,
            tabs: LOYALTY_TABS.map((id) => ({ id, label: input.tabs[id] })),
            ribbon: figures.props,
            overview: overview.props,
            members: members.props,
            rewards: rewards.props,
            promo: promo.props,
            pending: pending.props,
        },
        on: {
            selectTab: tabs.select,
            closeWhy: dashboard.closeWhy,
            retryDashboard: dashboard.reload,
            ribbon: figures.on,
            overview: overview.on,
            members: members.on,
            rewards: rewards.on,
            promo: promo.on,
            pending: pending.on,
        },
    }
}
