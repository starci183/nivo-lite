import { z } from "zod"

/** How a voided invoice that was posted is treated in the books. */
export const VOID_MODES: readonly ["reversal", "none"] = ["reversal", "none"]

/** One way of treating a voided invoice. */
export type VoidMode = (typeof VOID_MODES)[number]

/** How often the shop files value added tax: every month, or every quarter. */
export const VAT_PERIODS: readonly ["monthly", "quarterly"] = ["monthly", "quarterly"]

/** One way of filing value added tax. */
export type VatPeriod = (typeof VAT_PERIODS)[number]

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
    /** How often the shop files value added tax; the due-soon list reads it. */
    readonly vatPeriod: VatPeriod
}

/** The settings of a workspace that never saved any. */
export const ACCOUNTING_SETTINGS_DEFAULTS: AccountingSettings = {
    postExpenses: true,
    postOutgoing: true,
    postUnmatched: false,
    voidMode: "reversal",
    vatPeriod: "quarterly",
}

/** The shape of the saved settings. */
export const accountingSettingsShape: z.ZodObject<{
    postExpenses: z.ZodBoolean
    postOutgoing: z.ZodBoolean
    postUnmatched: z.ZodBoolean
    voidMode: z.ZodEnum<{ reversal: "reversal"; none: "none" }>
    vatPeriod: z.ZodEnum<{ monthly: "monthly"; quarterly: "quarterly" }>
}> = z.object({
    postExpenses: z.boolean(),
    postOutgoing: z.boolean(),
    postUnmatched: z.boolean(),
    voidMode: z.enum(VOID_MODES),
    vatPeriod: z.enum(VAT_PERIODS),
})
