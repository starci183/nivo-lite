import type { LoyaltyActions, LoyaltyViews } from "./loyalty-views"
import type { DataSlot, SlotLabels } from "@nivo/agent-sdk/workbench"
import type { WorkbenchDashboardRegions, WorkbenchExplanationView } from "@nivo/agent-sdk/workbench/view"

type LoyaltyTab = "overview" | "members" | "rewards" | "promo" | "pending"

/** The real read payload, its resolved copy and the shared region words; no renderer or operation lives in data. */
interface LoyaltyRegion<T, TCopy> {
    readonly slot: DataSlot<T>
    readonly copy: TCopy
    readonly labels: SlotLabels
}

type OverviewView = LoyaltyViews["overview"]
type OverviewRows = {
    readonly tiers: OverviewView["tiers"]["rows"]
    readonly stats: OverviewView["stats"]["items"]
    readonly linkUrl: string
}
type OverviewCopy = Omit<OverviewView, "tiers" | "stats" | "link"> & {
    readonly tiers: Omit<OverviewView["tiers"], "rows">
    readonly stats: Omit<OverviewView["stats"], "items">
    readonly link: Omit<OverviewView["link"], "url">
}

type MemberView = LoyaltyViews["member"]
type MemberIdentity = Pick<
    MemberView,
    "name" | "tier" | "points" | "contact" | "spentLine" | "joinedLine" | "nextTierLine" | "expiringLine" | "asOf"
>
type MemberRows = {
    readonly identity: MemberIdentity
    readonly rewardRows: MemberView["rewards"]["rows"]
    readonly ledgerRows: MemberView["ledger"]["rows"]
}
type MemberCopy = Omit<MemberView, keyof MemberIdentity | "rewards" | "ledger"> & {
    readonly rewards: Omit<MemberView["rewards"], "rows">
    readonly ledger: Omit<MemberView["ledger"], "rows">
}

interface CampaignResult {
    readonly title: string
    readonly recipients: string
    readonly time: string
    readonly draft: string
}

/** Explicit pure Loyalty region models, including the existing common dashboard/why owner and each actual read. */
export interface LoyaltyWorkbenchData {
    readonly why: WorkbenchExplanationView & { readonly label: string }
    readonly regions: WorkbenchDashboardRegions
    readonly tabsLabel: string
    readonly selectedTab: LoyaltyTab
    readonly tabs: ReadonlyArray<{ readonly id: LoyaltyTab; readonly label: string }>
    readonly ribbon: {
        readonly label: string
        readonly captions: ReadonlyArray<{ readonly id: string; readonly term: string }>
        readonly slot: DataSlot<ReadonlyArray<{ readonly id: string; readonly value: string; readonly meta: string }>>
        readonly labels: SlotLabels
    }
    readonly overview: LoyaltyRegion<OverviewRows, OverviewCopy> & {
        readonly isSyncing: boolean
        readonly syncNote?: { readonly title: string; readonly description: string }
    }
    readonly members: LoyaltyRegion<
        { readonly rows: LoyaltyViews["members"]["rows"] },
        Omit<LoyaltyViews["members"], "rows">
    > & {
        readonly detail: LoyaltyRegion<MemberRows, MemberCopy>
    }
    readonly rewards: LoyaltyRegion<
        { readonly rows: LoyaltyViews["rewards"]["rows"] },
        Omit<LoyaltyViews["rewards"], "rows">
    >
    readonly promo: LoyaltyRegion<
        { readonly rows: LoyaltyViews["promotion"]["rows"] },
        Omit<LoyaltyViews["promotion"], "rows">
    > & {
        readonly preview: {
            readonly slot: DataSlot<
                ReadonlyArray<{ readonly id: string; readonly text: string; readonly emphasis: boolean }>
            >
            readonly labels: SlotLabels
            readonly loadingLabel: string
            readonly audienceLabel: string
        }
        readonly campaign: {
            readonly slot: DataSlot<{
                readonly result: CampaignResult | undefined
                readonly failure: string | undefined
            }>
            readonly labels: SlotLabels
            readonly hasCampaign: boolean
        }
    }
    readonly pending: LoyaltyRegion<
        { readonly rows: LoyaltyViews["decisions"]["rows"] },
        Omit<LoyaltyViews["decisions"], "rows">
    >
}

/** Only the existing atomic event arguments cross the separate action carrier; native delete keeps its real Promise. */
export interface LoyaltyWorkbenchOn {
    readonly selectTab: (id: string) => void
    readonly closeWhy: () => void
    readonly retryDashboard: () => void
    readonly ribbon: { readonly retry: () => void }
    readonly overview: LoyaltyActions["overview"]
    readonly members: LoyaltyActions["members"] & { readonly detail: LoyaltyActions["member"] }
    readonly rewards: LoyaltyActions["rewards"]
    readonly promo: LoyaltyActions["promotion"]
    readonly pending: LoyaltyActions["decisions"]
}
