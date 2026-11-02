import type { BadgeTone } from "@starci/grammar/common"
import type { WorkbenchDashboardRegions, WorkbenchExplanationView, WorkbenchFigureRegion } from "./workbench-dashboard"
import type { SlotPanelProps } from "./slot"
interface LeadGenRowBadge {
    readonly label: string
    readonly tone: BadgeTone
    readonly isDot?: boolean
}
interface LeadGenRow {
    readonly id: string
    readonly title: string
    readonly href: string | null
    readonly description: string
    readonly badges: ReadonlyArray<LeadGenRowBadge>
}
/** LeadGenListView resolved data. */
export interface LeadGenListView {
    readonly label: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly rows: ReadonlyArray<LeadGenRow>
    readonly hiddenText: string | null
}
interface LeadGenCommentView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly sourceLabel: string
    readonly comment: string
    readonly draft: string
    readonly isEditing: boolean
    readonly draftValue: string
    readonly error: string | null
}
/** LeadGenCommentsView resolved data. */
export interface LeadGenCommentsView {
    readonly label: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly draftLabel: string
    readonly noDraft: string
    readonly editLabel: string
    readonly approveLabel: string
    readonly cancelLabel: string
    readonly saveApproveLabel: string
    readonly retryLabel: string
    readonly rows: ReadonlyArray<LeadGenCommentView>
    readonly busyId: string | null
    readonly isApproving: boolean
}
/** LeadGenPanelView resolved data. */
export interface LeadGenPanelView {
    readonly leads: LeadGenListView
    readonly sources: LeadGenListView
    readonly handoffs: LeadGenListView
    readonly comments: LeadGenCommentsView
}
/** LeadGenWorkbenchDataView resolved data. */
export interface LeadGenWorkbenchDataView {
    readonly why: WorkbenchExplanationView
    readonly regions: WorkbenchDashboardRegions
    readonly tabsLabel: string
    readonly selectedTab: string
    readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly ribbon: WorkbenchFigureRegion
    readonly panel: SlotPanelProps<LeadGenPanelView>
}
/** LeadGenWorkbenchActions resolved data. */
export interface LeadGenWorkbenchActions {
    readonly selectTab: (key: string) => void
    readonly closeWhy: () => void
    readonly retryDashboard: () => void
    readonly retry: () => void
    readonly comments: {
        readonly edit: (id: string) => void
        readonly cancel: (id: string) => void
        readonly draft: (id: string, value: string) => void
        readonly approve: (id: string, edited: boolean) => void
        readonly retry: () => void
    }
}

/** The original workbench areas in route and display order. */
export const LEADGEN_TABS = ["leads", "sources", "comments", "handoffs"] as const
