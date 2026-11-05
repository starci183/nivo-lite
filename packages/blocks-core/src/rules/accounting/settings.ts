import { z } from "zod"

/** How a voided invoice that was posted is treated in the books. */
export const VOID_MODES: readonly ["reversal", "none"] = ["reversal", "none"]

/** One way of treating a voided invoice. */
export type VoidMode = (typeof VOID_MODES)[number]

/** What each customer decides about their books: which money and documents become entries. */
export interface AccountingSettings {
    /** Whether money out (a debit payment) is posted as an expense. */
    readonly postExpenses: boolean
    /** Whether an invoice the shop issued is posted as what is owed to it. */
    readonly postOutgoing: boolean
    /** Whether money in that nobody tied to what it paid is posted as income already. */
    readonly postUnmatched: boolean
    /** A voided posted invoice gets a reversal entry (the books never delete), or nothing. */
    readonly voidMode: VoidMode
}

/** The settings of a workspace that never saved any. */
export const ACCOUNTING_SETTINGS_DEFAULTS: AccountingSettings = {
    postExpenses: true,
    postOutgoing: true,
    postUnmatched: false,
    voidMode: "reversal",
}

/** The shape of the saved settings. */
export const accountingSettingsShape: z.ZodObject<{
    postExpenses: z.ZodBoolean
    postOutgoing: z.ZodBoolean
    postUnmatched: z.ZodBoolean
    voidMode: z.ZodEnum<{ reversal: "reversal"; none: "none" }>
}> = z.object({
    postExpenses: z.boolean(),
    postOutgoing: z.boolean(),
    postUnmatched: z.boolean(),
    voidMode: z.enum(VOID_MODES),
})
