import type { PayableOrder } from "@modules/domain/billing"

/** A top-up pack as sold: server data, never taken from the caller. */
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

/** One purchased top-up lot and the credits still spendable. */
export interface CreditTopupLot {
    /** Credits originally purchased. */
    readonly credits: number
    /** The price paid in VND. */
    readonly priceVnd: number
    /** When the credits were purchased, ISO 8601. */
    readonly purchasedAt: string
    /** When the credits expire, ISO 8601. */
    readonly expiresAt: string
    /** Credits left in this lot. */
    readonly creditsRemaining: number
}

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
