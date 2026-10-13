/** Presentation contracts of workspace credits and payment drawers. */
export type PlanView = {
    readonly code: string
    readonly nameVi: string
    readonly nameEn: string
    /** Monthly credits (null = unlimited). */
    readonly credits: number | null
    /** The price of one month (per seat on a per-seat plan). */
    readonly price: number
    readonly seats: number
    readonly isCustom: boolean
    /** One person only: no other members can be invited. */
    readonly individual: boolean
    /** The price is per seat. */
    readonly perSeat: boolean
    /** Storage included in GB (null = not capped). */
    readonly storageGb: number | null
}

/** A pack as the credits page shows it. */
export type PackView = {
    readonly code: string
    readonly credits: number
    readonly price: number
}

/** One payment order as the credits page lists it. */
export type OrderRow = {
    readonly id: string
    readonly kind: "plan" | "upgrade" | "topup"
    readonly planCode: string
    readonly packCredits: number | null
    readonly amount: number
    readonly createdAt: string
    readonly status: "pending" | "paid" | "expired" | "cancelled"
    readonly code: string
}

/** Everything the credits page needs for one workspace. */
export type CreditsData = {
    /** Owner | manager may buy; staff read only. */
    readonly workspaceId: string
    readonly canBuy: boolean
    readonly paidUntil: string | null
    readonly plan: PlanView | null
    /** This month's credits spent, the allowance with rollover (null = unlimited) and the rollover itself. */
    readonly used: number
    readonly limit: number | null
    readonly carried: number
    /** Top-up credits spendable now and the soonest date some of them expire. */
    readonly topup: number
    readonly topupExpires: string | null
    /** YYYY-MM-DD the allowance runs out this month at the last 7 days' burn, or null. */
    readonly runout: string | null
    readonly packs: ReadonlyArray<PackView>
    readonly plans: ReadonlyArray<PlanView>
    readonly next: { readonly plan: PlanView } | null
    /** Shown instead of an upgrade on Max and Enterprise. */
    readonly contact: { readonly plan: PlanView | null; readonly href: string } | null
    readonly orders: ReadonlyArray<OrderRow>
    readonly bank: { readonly account: string; readonly bank: string; readonly holder: string }
}

/** A payment screen's order: created on the server, shown as VietQR in the drawer. */
export type PayOrder = {
    readonly id: string
    readonly code: string
    readonly amount: number
    readonly expiresAt: string
    readonly qrUrl: string
    /** Upgrade only: the unused value of the current plan that was deducted, and the days it is worth. */
    readonly credit?: number
    readonly daysLeft?: number
}

/** The product shown in the payment drawer. */
export type PayTarget =
    | { readonly kind: "topup"; readonly packCode: string; readonly credits: number }
    | { readonly kind: "upgrade"; readonly planCode: string; readonly planName: string; readonly price: number }

/** Settled presentation of the credits overview. */
export interface CreditsOverviewView {
    readonly canBuy: boolean
    readonly staffNote: string
    readonly balance: {
        readonly figure: string
        readonly badge: string
        readonly badgeTone: "danger" | "warning"
        readonly used: number
        readonly limit: number | null
        readonly meterLabel: string
        readonly meterValue: string
        readonly details: ReadonlyArray<{ readonly id: string; readonly term: string; readonly value: string }>
    }
    readonly packs: ReadonlyArray<{
        readonly id: string
        readonly title: string
        readonly description: string
        readonly pending: boolean
        readonly disabled: boolean
        readonly target: PayTarget
    }>
    readonly upgrade: {
        readonly name: string
        readonly line: string
        readonly price: string
        readonly action: string
        readonly pending: boolean
        readonly disabled: boolean
        readonly target: PayTarget
    } | null
    readonly contact: {
        readonly name: string
        readonly text: string
        readonly action: string
        readonly href: string
    } | null
    readonly plans: ReadonlyArray<{
        readonly id: string
        readonly title: string
        readonly description: string
        readonly badge: string
    }>
}

/** One localized row of the credit purchase history. */
export interface CreditsHistoryRow {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly status: string
    readonly tone: "success" | "warning" | "neutral"
}
