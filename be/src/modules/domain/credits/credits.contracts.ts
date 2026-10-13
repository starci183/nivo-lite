import type { BankAccountOptions, PayableOrder } from "@modules/domain/billing"
import type { PaymentOrder } from "@modules/domain/payment-orders"

/** A top-up pack as sold: server data, never taken from the browser. */
export interface CreditPack {
    /** The pack code. */
    readonly code: string
    /** The credits the pack adds. */
    readonly credits: number
    /** The price in VND. */
    readonly priceVnd: number
    /** The order of the catalogue. */
    readonly sort: number
}

/** A pack, or null when none matches. */
export type PackLookup = CreditPack | null

/** The unused value of the current plan that an upgrade deducts. */
export interface Proration {
    /** What the buyer pays now (VND, a multiple of 1,000, never negative). */
    readonly amount: number
    /** The unused value of the current plan that was deducted. */
    readonly credit: number
    /** Whole days left in the paid period (rounded up). */
    readonly daysLeft: number
}

/** What an upgrade costs a workspace right now. */
export interface UpgradeQuote extends Proration {
    /** The plan the workspace moves from. */
    readonly fromCode: string
}

/** An upgrade order and the figures it froze. */
export interface UpgradeOrder {
    /** The order with the QR that pays it. */
    readonly payable: PayableOrder
    /** The figures of the order. */
    readonly quote: UpgradeQuote
}

/** The pack a workspace asks to buy. */
export interface TopupParams {
    /** The workspace that pays. */
    readonly workspaceId: string
    /** The pack code. */
    readonly packCode: string
}

/** The plan a workspace asks to upgrade to. */
export interface UpgradeParams {
    /** The workspace that pays. */
    readonly workspaceId: string
    /** The target plan code. */
    readonly planCode: string
}

/** One top-up lot as the overview reads it. */
export interface TopupLot {
    /** The credits bought. */
    readonly credits: number
    /** The VND paid. */
    readonly priceVnd: number
    /** When it was bought, ISO 8601. */
    readonly purchasedAt: string
    /** When the unspent part expires, ISO 8601. */
    readonly expiresAt: string
    /** The credits still unspent. */
    readonly creditsRemaining: number
}

/** A plan as the credits page shows it. */
export interface PlanView {
    /** The plan code. */
    readonly code: string
    /** The Vietnamese name. */
    readonly nameVi: string
    /** The English name. */
    readonly nameEn: string
    /** Monthly credits; null is unlimited. */
    readonly credits: number | null
    /** The price in VND. */
    readonly price: number
    /** VND per monthly credit. */
    readonly perCredit: number
    /** The seats. */
    readonly seats: number
    /** A contract plan. */
    readonly isCustom: boolean
}

/** A pack as the credits page shows it. */
export interface PackView {
    /** The pack code. */
    readonly code: string
    /** The credits. */
    readonly credits: number
    /** The price in VND. */
    readonly price: number
    /** VND per credit. */
    readonly perCredit: number
    /** How much cheaper than the smallest pack, whole percent. */
    readonly discountPct: number
}

/** Why a plan is recommended, from real data. */
export type UpgradeReason =
    | { readonly kind: "topups"; readonly credits: number; readonly saving: number }
    | { readonly kind: "cheaper"; readonly pct: number }
    | { readonly kind: "plain" }

/** One payment order as the credits page lists it. */
export interface OrderLine {
    /** The order id. */
    readonly id: string
    /** The kind. */
    readonly kind: PaymentOrder["kind"]
    /** The plan code on the order. */
    readonly planCode: string
    /** The credits of a top-up, or null. */
    readonly packCredits: number | null
    /** The amount in VND. */
    readonly amount: number
    /** When it was created, ISO 8601. */
    readonly createdAt: string
    /** The status. */
    readonly status: PaymentOrder["status"]
    /** The transfer content. */
    readonly code: string
}

/** The plan recommended next and why. */
export interface NextPlan {
    /** The plan. */
    readonly plan: PlanView
    /** Why it is recommended. */
    readonly reason: UpgradeReason
}

/** Everything the credits page needs for one workspace. */
export interface CreditsOverview {
    /** Owner and manager may buy; staff read only. */
    readonly canBuy: boolean
    /** The end of the paid period, ISO 8601, or null. */
    readonly paidUntil: string | null
    /** The workspace status. */
    readonly workspaceStatus: string
    /** The plan of the workspace, or null. */
    readonly plan: PlanView | null
    /** Credits spent this month. */
    readonly used: number
    /** This month's allowance with rollover; null is unlimited. */
    readonly limit: number | null
    /** Credits carried over. */
    readonly carried: number
    /** Top-up credits spendable now. */
    readonly topup: number
    /** The soonest date some top-up credits expire, ISO 8601, or null. */
    readonly topupExpires: string | null
    /** YYYY-MM-DD the allowance runs out this month at the last 7 days' burn, or null. */
    readonly runout: string | null
    /** The packs on sale. */
    readonly packs: ReadonlyArray<PackView>
    /** The self-serve plans. */
    readonly plans: ReadonlyArray<PlanView>
    /** The next plan up, or null on the top plan. */
    readonly next: NextPlan | null
    /** Shown instead of an upgrade on the top plans: the contract plan, when any. */
    readonly contact: { readonly plan: PlanView | null } | null
    /** The latest payment orders. */
    readonly orders: ReadonlyArray<OrderLine>
    /** The bank account customers pay into. */
    readonly bank: BankAccountOptions
}
