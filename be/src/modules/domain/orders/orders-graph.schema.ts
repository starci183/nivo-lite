import { z } from "zod"

/** The longest id or name a node payload holds. */
const NAME_MAX = 200
/** The longest note a node payload holds. */
const NOTE_MAX = 2000
/** The most item lines one recorded order holds. */
const ITEMS_MAX = 100

/** What the `order.record` effect carries: the customer, the item lines, the amount and an optional note. */
export const recordPayloadSchema: z.ZodObject<
    {
        leadId: z.ZodString
        items: z.ZodArray<z.ZodObject<{ name: z.ZodString; qty: z.ZodNumber }, z.core.$strip>>
        amountVnd: z.ZodNullable<z.ZodNumber>
        note: z.ZodOptional<z.ZodString>
    },
    z.core.$strip
> = z.object({
    leadId: z.string().min(1).max(NAME_MAX),
    items: z
        .array(z.object({ name: z.string().max(NAME_MAX), qty: z.number() }))
        .min(1)
        .max(ITEMS_MAX),
    amountVnd: z.number().nullable(),
    note: z.string().max(NOTE_MAX).optional(),
})

/** What the `order.confirm` effect carries: the draft order to confirm. */
export const confirmPayloadSchema: z.ZodObject<{ orderId: z.ZodString }, z.core.$strip> = z.object({
    orderId: z.string().min(1).max(NAME_MAX),
})
