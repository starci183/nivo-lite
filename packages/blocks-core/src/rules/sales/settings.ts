import { z } from "zod"

/** The default threshold: an order of 5,000,000 VND or more waits for the owner. */
export const DEFAULT_THRESHOLD_VND = 5_000_000

/** The most the owner threshold may be set to, VND. */
export const MAX_THRESHOLD_VND = 1_000_000_000_000

/** The most a discount limit may be set to, percent. */
export const MAX_DISCOUNT_PCT = 100

/** The most days a reminder may wait. */
export const MAX_REMIND_DAYS = 30

/** What each customer decides about their sales: who may confirm an order and how a deal may move. */
export interface SalesSettings {
    /** An order of this amount or more, VND, waits for someone who holds the owner's right. */
    readonly approvalThresholdVnd: number
    /** Whether a draft order with no total yet waits for the owner. */
    readonly draftWithoutTotalNeedsApproval: boolean
    /** Whether a closed deal may switch between won and lost. */
    readonly closedDealsCanFlip: boolean
    /** Whether moving a closed deal back to an open stage takes the owner's right. */
    readonly reopenNeedsApproval: boolean
    /** The most a quote may be discounted without waiting for the owner, in percent. */
    readonly maxDiscountPct: number
    /** After how many days without an answer the assistant drafts a reminder to the customer. */
    readonly remindAfterDays: number
    /** Whether a confirmed order moves its deal to won by itself. */
    readonly autoWon: boolean
    /** Whether a won deal is handed to Accounting for the invoice and the money. */
    readonly notifyAccounting: boolean
}

/** The settings of a workspace that never saved any. */
export const SALES_SETTINGS_DEFAULTS: SalesSettings = {
    approvalThresholdVnd: DEFAULT_THRESHOLD_VND,
    draftWithoutTotalNeedsApproval: true,
    closedDealsCanFlip: true,
    reopenNeedsApproval: true,
    maxDiscountPct: 10,
    remindAfterDays: 3,
    autoWon: true,
    notifyAccounting: true,
}

/** The shape of the saved settings, each value in range. */
export const salesSettingsShape: z.ZodObject<{
    approvalThresholdVnd: z.ZodNumber
    draftWithoutTotalNeedsApproval: z.ZodBoolean
    closedDealsCanFlip: z.ZodBoolean
    reopenNeedsApproval: z.ZodBoolean
    maxDiscountPct: z.ZodNumber
    remindAfterDays: z.ZodNumber
    autoWon: z.ZodBoolean
    notifyAccounting: z.ZodBoolean
}> = z.object({
    approvalThresholdVnd: z.number().min(0).max(MAX_THRESHOLD_VND),
    draftWithoutTotalNeedsApproval: z.boolean(),
    closedDealsCanFlip: z.boolean(),
    reopenNeedsApproval: z.boolean(),
    maxDiscountPct: z.number().int().min(0).max(MAX_DISCOUNT_PCT),
    remindAfterDays: z.number().int().min(1).max(MAX_REMIND_DAYS),
    autoWon: z.boolean(),
    notifyAccounting: z.boolean(),
})

/** The part of the settings that decides whether an order of a total waits for the owner. */
export type ApprovalSettings = Pick<SalesSettings, "approvalThresholdVnd">

/** True when an order of this total waits for the owner: at the threshold or above. */
export const needsOwner = (totalVnd: number, settings: ApprovalSettings): boolean =>
    totalVnd >= settings.approvalThresholdVnd
