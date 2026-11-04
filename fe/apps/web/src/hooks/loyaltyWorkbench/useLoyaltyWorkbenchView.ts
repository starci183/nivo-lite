import { useAgentWorkbenchShell, type AgentWorkbenchFrame } from "@/hooks/agentDashboard"
import { LOYALTY_VIEW_IDS } from "@nivo-lite/module-loyalty/manifest"
import type { LoyaltyTab, LoyaltyPanelInput } from "@/hooks/loyalty"
import { useQueryLoyaltyBoardSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useLoyaltyFiguresView, type LoyaltyFiguresView } from "./useLoyaltyFiguresView"
import { useLoyaltyOverviewView, type LoyaltyOverviewView } from "./useLoyaltyOverviewView"
import { useLoyaltyMembersView, type LoyaltyMembersViewShape } from "./useLoyaltyMembersView"
import { useLoyaltyRewardsView, type LoyaltyRewardsViewShape } from "./useLoyaltyRewardsView"
import { useLoyaltyPromoView, type LoyaltyPromoView3 } from "./useLoyaltyPromoView"
import { useLoyaltyPendingView, type LoyaltyPendingView3 } from "./useLoyaltyPendingView"

/** Server-resolved route identity and the five actual tab labels. */
interface LoyaltyWorkbenchInput {
    readonly installationId: string
    readonly initialTab: string | null
    readonly tabs: Readonly<Record<LoyaltyTab, string>>
}

/** The props of the workbench: the frame, the ribbon and the five panels, each as the hook that owns it draws them. */
export interface LoyaltyWorkbenchProps extends Omit<AgentWorkbenchFrame<LoyaltyTab>, "why"> {
    why: AgentWorkbenchFrame<LoyaltyTab>["why"] & { label: string }
    ribbon: LoyaltyFiguresView["props"]
    overview: LoyaltyOverviewView["props"]
    members: LoyaltyMembersViewShape["props"]
    rewards: LoyaltyRewardsViewShape["props"]
    promo: LoyaltyPromoView3["props"]
    pending: LoyaltyPendingView3["props"]
}

/** The commands of the workbench: the tab and the retries, then those of each panel. */
export interface LoyaltyWorkbenchOn {
    selectTab: (id: string) => void
    closeWhy: () => void
    retryDashboard: () => void
    ribbon: LoyaltyFiguresView["on"]
    overview: LoyaltyOverviewView["on"]
    members: LoyaltyMembersViewShape["on"]
    rewards: LoyaltyRewardsViewShape["on"]
    promo: LoyaltyPromoView3["on"]
    pending: LoyaltyPendingView3["on"]
}

/** The view `useLoyaltyWorkbenchView` returns. */
export interface LoyaltyWorkbenchView {
    shape: "overview" | "explanation" | "members" | "promo" | "decisions" | "rewards"
    props: LoyaltyWorkbenchProps
    on: LoyaltyWorkbenchOn
}

/** Owns the shared dashboard, one board read and the actual conditional panel sessions. */
export const useLoyaltyWorkbenchView = (input: LoyaltyWorkbenchInput): LoyaltyWorkbenchView => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const scope = JSON.stringify([activeWorkspaceId, input.installationId])
    const { tabs, dashboard, isNormal } = useAgentWorkbenchShell({
        module: "loyalty",
        installationId: input.installationId,
        ids: LOYALTY_VIEW_IDS,
        initialTab: input.initialTab,
        scope,
    })
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
            tabs: LOYALTY_VIEW_IDS.map((id) => ({ id, label: input.tabs[id] })),
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
