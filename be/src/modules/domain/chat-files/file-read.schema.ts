import { z } from "zod"

/** The most a read may state: a sum beyond it is a misread. */
const AMOUNT_MAX = 100_000_000_000

/** What the model reads from a file a customer sent: every field may be empty, because a read that is not sure says so. */
export const fileReadSchema = z.object({
    is_transfer: z.boolean(),
    amount_vnd: z.number().int().positive().max(AMOUNT_MAX).nullable(),
    recipient: z.string().max(200).nullable(),
    paid_at: z.string().max(40).nullable(),
    clear: z.boolean(),
})
