import { z } from "zod"

const MAX_RULES = 50

/** What the model answers when it is asked which sums the setup text makes a person decide. */
export interface StatedRulesAnswer {
    /** The rules it read, each with the words of the text that state it. */
    readonly rules: Array<{ readonly amount_vnd: number; readonly quote: string }>
}

/** The closed answer of the reading: whole positive sums, each with the quote that states it. */
export const statedRulesSchema: z.ZodType<StatedRulesAnswer> = z.object({
    rules: z
        .array(z.object({ amount_vnd: z.number().int().positive(), quote: z.string().trim().min(1).max(2000) }))
        .max(MAX_RULES),
})
