import { z } from "zod"

/** The default threshold: an order of 5,000,000 VND or more waits for the owner. */
export const DEFAULT_THRESHOLD_VND = 5_000_000

/** The most the owner threshold may be set to, VND. */
export const MAX_THRESHOLD_VND = 1_000_000_000_000

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
}

/** The settings of a workspace that never saved any. */
export const SALES_SETTINGS_DEFAULTS: SalesSettings = {
    approvalThresholdVnd: DEFAULT_THRESHOLD_VND,
    draftWithoutTotalNeedsApproval: true,
    closedDealsCanFlip: true,
    reopenNeedsApproval: true,
}

/** The shape of the saved settings, each value in range. */
export const salesSettingsShape: z.ZodObject<{
    approvalThresholdVnd: z.ZodNumber
    draftWithoutTotalNeedsApproval: z.ZodBoolean
    closedDealsCanFlip: z.ZodBoolean
    reopenNeedsApproval: z.ZodBoolean
}> = z.object({
    approvalThresholdVnd: z.number().min(0).max(MAX_THRESHOLD_VND),
    draftWithoutTotalNeedsApproval: z.boolean(),
    closedDealsCanFlip: z.boolean(),
    reopenNeedsApproval: z.boolean(),
})

/** The part of the settings that decides whether an order of a total waits for the owner. */
export type ApprovalSettings = Pick<SalesSettings, "approvalThresholdVnd">

/** True when an order of this total waits for the owner: at the threshold or above. */
export const needsOwner = (totalVnd: number, settings: ApprovalSettings): boolean =>
    totalVnd >= settings.approvalThresholdVnd
