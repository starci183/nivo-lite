import { z } from "zod"

/** The bounded filters shared by the bank credit and debit tools. */
export const SEPAY_BANK_MOVE_SCHEMA: z.ZodObject<
    {
        since: z.ZodOptional<z.ZodISODateTime>
        limit: z.ZodDefault<z.ZodNumber>
    },
    z.core.$strict
> = z
    .object({
        since: z.iso.datetime({ offset: true }).min(20).max(40).optional(),
        limit: z.number().int().min(1).max(50).default(20),
    })
    .strict()

/** The schema announced by both SePay tools, generated from their argument validator. */
export const SEPAY_BANK_MOVE_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<
    z.ZodObject<
        {
            since: z.ZodOptional<z.ZodISODateTime>
            limit: z.ZodDefault<z.ZodNumber>
        },
        z.core.$strict
    >
> = z.toJSONSchema(SEPAY_BANK_MOVE_SCHEMA, { io: "input" })

/** The longest credit id the credit list takes (the row ids are UUIDs). */
const CREDIT_ID_MAX = 128

/**
 * The filters of the credit list: the bank move filters, and the ONE credit a step handles (`transactionId`, the raw row id the bank
 * trigger names). Naming it narrows the answer to that credit.
 */
export const SEPAY_CREDIT_LIST_SCHEMA: z.ZodObject<
    {
        since: z.ZodOptional<z.ZodISODateTime>
        limit: z.ZodDefault<z.ZodNumber>
        transactionId: z.ZodOptional<z.ZodString>
    },
    z.core.$strict
> = SEPAY_BANK_MOVE_SCHEMA.extend({
    transactionId: z.string().min(1).max(CREDIT_ID_MAX).optional(),
}).strict()

/** The schema announced by the credit list, generated from its argument validator. */
export const SEPAY_CREDIT_LIST_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<typeof SEPAY_CREDIT_LIST_SCHEMA> = z.toJSONSchema(
    SEPAY_CREDIT_LIST_SCHEMA,
    { io: "input" },
)
