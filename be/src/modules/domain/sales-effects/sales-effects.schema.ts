import { z } from "zod"

/** The longest id a payload names. */
const ID_MAX = 200

/** The longest name, address or item name a payload carries. */
const LINE_MAX = 500

/** The longest note a payload carries. */
const NOTE_MAX = 20_000

/** The most item lines one recorded order holds. */
const ITEMS_MAX = 100

/** The most a total may be, VND. */
const AMOUNT_MAX = 1_000_000_000_000

/** What `lead.ensure` asks for: the conversation whose customer is wanted, and what the chat knows of them. */
export const ensureSchema: z.ZodObject<{
    conversationId: z.ZodString
    name: z.ZodOptional<z.ZodString>
    phone: z.ZodOptional<z.ZodString>
}> = z.object({
    conversationId: z.string().min(1).max(ID_MAX),
    name: z.string().min(1).max(LINE_MAX).optional(),
    phone: z.string().min(1).max(LINE_MAX).optional(),
})

/** What `order.record` carries: the customer, the item lines, the total and an optional note. */
export const recordSchema: z.ZodObject<{
    leadId: z.ZodString
    items: z.ZodArray<z.ZodObject<{ name: z.ZodString; qty: z.ZodNumber; unitVnd: z.ZodOptional<z.ZodNumber> }>>
    amountVnd: z.ZodNullable<z.ZodNumber>
    note: z.ZodOptional<z.ZodString>
}> = z.object({
    leadId: z.string().min(1).max(ID_MAX),
    items: z
        .array(
            z.object({
                name: z.string().min(1).max(LINE_MAX),
                qty: z.number().positive(),
                unitVnd: z.number().int().min(0).max(AMOUNT_MAX).optional(),
            }),
        )
        .min(1)
        .max(ITEMS_MAX),
    amountVnd: z.number().int().min(0).max(AMOUNT_MAX).nullable(),
    note: z.string().max(NOTE_MAX).optional(),
})

/** What `order.confirm` carries: the draft to confirm. */
export const confirmSchema: z.ZodObject<{ orderId: z.ZodString }> = z.object({
    orderId: z.string().min(1).max(ID_MAX),
})

/** What `order.void` carries: the order to cut short. */
export const voidSchema: z.ZodObject<{ id: z.ZodString }> = z.object({ id: z.string().min(1).max(ID_MAX) })

/** What a conversation record holds that a customer is made from. */
export const conversationSchema: z.ZodObject<{ name: z.ZodString; channel: z.ZodString }> = z.object({
    name: z.string().max(LINE_MAX),
    channel: z.string().max(ID_MAX),
})

/** The id of a record: a uuid; any other text names no record. */
export const recordIdSchema: z.ZodGUID = z.guid()
