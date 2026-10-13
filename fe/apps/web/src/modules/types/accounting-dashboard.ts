import type { BadgeTone } from "@starci/grammar/common"

/** A settled status mark on an accounting dashboard row. */
interface DashboardBadge {
    readonly label: string
    readonly tone: BadgeTone
    readonly isDot?: boolean
}

/** A settled destination and its visible label. */
interface DashboardLink {
    readonly href: string
    readonly label: string
}

/** One plain display row in a shared accounting dashboard region. */
interface DashboardRow {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly href?: string
    readonly action?: DashboardLink
    readonly badges?: ReadonlyArray<DashboardBadge>
}

/** A shared dashboard region with all copy and row descriptions resolved. */
export interface AccountingDashboardSectionView {
    readonly label: string
    readonly empty: string
    readonly emptyBody: string
    readonly failedDescription: string
    readonly hasFailed: boolean
    readonly rows: ReadonlyArray<DashboardRow>
    readonly badge?: DashboardBadge
    readonly link?: DashboardLink
    readonly footer?: string
}

/** The accounting frame's complete display model, independent of locale and transport. */
export interface AccountingDashboardView {
    readonly heading: string
    readonly mode: DashboardBadge | null
    readonly chat: DashboardLink | null
    readonly labels: {
        readonly failure: string
        readonly failureBody: string
        readonly retry: string
        readonly ribbon: string
        readonly tabs: string
    }
    readonly waiting: AccountingDashboardSectionView
    readonly done: AccountingDashboardSectionView
    readonly connections: AccountingDashboardSectionView
    readonly knowledge: AccountingDashboardSectionView
    readonly gaps: AccountingDashboardSectionView | null
}
