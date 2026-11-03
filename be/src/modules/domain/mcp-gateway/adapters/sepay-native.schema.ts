import { z } from "zod"

/** The bounded filters shared by the bank credit and debit tools. */
export const SEPAY_BANK_MOVE_SCHEMA: z.ZodObject<
    {
        status: z.ZodOptional<
            z.ZodEnum<{
                unmatched: "unmatched"
                matched: "matched"
                needs_review: "needs_review"
            }>
        >
        since: z.ZodOptional<z.ZodISODateTime>
        limit: z.ZodDefault<z.ZodNumber>
    },
    z.core.$strict
> = z
    .object({
        status: z.enum(["unmatched", "matched", "needs_review"]).optional(),
        since: z.iso.datetime({ offset: true }).min(20).max(40).optional(),
        limit: z.number().int().min(1).max(50).default(20),
    })
    .strict()

/** The schema announced by both SePay tools, generated from their argument validator. */
export const SEPAY_BANK_MOVE_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<
    z.ZodObject<
        {
            status: z.ZodOptional<
                z.ZodEnum<{
                    unmatched: "unmatched"
                    matched: "matched"
                    needs_review: "needs_review"
                }>
            >
            since: z.ZodOptional<z.ZodISODateTime>
            limit: z.ZodDefault<z.ZodNumber>
        },
        z.core.$strict
    >
> = z.toJSONSchema(SEPAY_BANK_MOVE_SCHEMA, { io: "input" })
