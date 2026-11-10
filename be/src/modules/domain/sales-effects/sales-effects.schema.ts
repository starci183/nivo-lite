import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
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

/**
 * What `order.create` carries: the customer, what they order (a catalogue item by id or by name, and how many), where it goes, the name
 * and phone of the person who receives it, when it is delivered (in the customer's words) and a note.
 */
export const recordSchema: z.ZodObject<{
    leadId: z.ZodString
    items: z.ZodArray<
        z.ZodObject<{ catalogueItemId: z.ZodOptional<z.ZodString>; name: z.ZodOptional<z.ZodString>; qty: z.ZodNumber }>
    >
    address: z.ZodOptional<z.ZodString>
    recipientName: z.ZodOptional<z.ZodString>
    recipientPhone: z.ZodOptional<z.ZodString>
    deliveryAt: z.ZodOptional<z.ZodString>
    note: z.ZodOptional<z.ZodString>
    orderId: z.ZodOptional<z.ZodString>
}> = z.object({
    leadId: z.string().min(1).max(ID_MAX),
    items: z
        .array(
            z.object({
                catalogueItemId: z.string().min(1).max(ID_MAX).optional(),
                name: z.string().min(1).max(LINE_MAX).optional(),
                qty: z.number().positive(),
            }),
        )
        .min(1)
        .max(ITEMS_MAX),
    address: z.string().max(LINE_MAX).optional(),
    recipientName: z.string().max(LINE_MAX).optional(),
    recipientPhone: z.string().max(LINE_MAX).optional(),
    deliveryAt: z.string().max(LINE_MAX).optional(),
    note: z.string().max(NOTE_MAX).optional(),
    orderId: z.string().min(1).max(ID_MAX).optional(),
})

/** What `order.confirm` carries: the draft to confirm. */
export const confirmSchema: z.ZodObject<{ orderId: z.ZodString }> = z.object({
    orderId: z.string().min(1).max(ID_MAX),
})

/** What `order.void` carries: the order to cut short. */
export const voidSchema: z.ZodObject<{ id: z.ZodString }> = z.object({ id: z.string().min(1).max(ID_MAX) })

/** What `payment.rematch` carries: the order whose payment code was just sent. */
export const rematchSchema: z.ZodObject<{ orderId: z.ZodString }> = z.object({ orderId: z.string().min(1).max(ID_MAX) })

/** The most evidence lines and payer names a payment payload carries. */
const PAYMENT_ENTRIES_MAX = 100

/** What `payment.order.settle` carries: the order and the bank transaction that paid it, and the claim it answers when the agent names one. */
export const markPaidSchema: z.ZodObject<{
    orderId: z.ZodString
    transactionId: z.ZodString
    claimId: z.ZodOptional<z.ZodString>
}> = z.object({
    orderId: z.string().min(1).max(ID_MAX),
    transactionId: z.string().min(1).max(ID_MAX),
    claimId: z.string().min(1).max(ID_MAX).optional(),
})

/** What `payment.claim.record` carries: who said they paid, in which conversation, how much and under which names, in their words, and the order when the agent decided which. */
export const claimRecordSchema: z.ZodObject<{
    orderId: z.ZodOptional<z.ZodString>
    leadId: z.ZodNullable<z.ZodString>
    conversationId: z.ZodString
    amountVnd: z.ZodOptional<z.ZodNumber>
    names: z.ZodArray<z.ZodString>
    body: z.ZodString
}> = z.object({
    orderId: z.string().min(1).max(ID_MAX).optional(),
    leadId: z.string().min(1).max(ID_MAX).nullable(),
    conversationId: z.string().min(1).max(ID_MAX),
    amountVnd: z.number().int().positive().max(AMOUNT_MAX).optional(),
    names: z.array(z.string().max(LINE_MAX)).max(PAYMENT_ENTRIES_MAX),
    body: z.string().min(1).max(NOTE_MAX),
})

/** What a conversation record holds that a customer is made from. */
export const conversationSchema: z.ZodObject<{ name: z.ZodString; channel: z.ZodString }> = z.object({
    name: z.string().max(LINE_MAX),
    channel: z.string().max(ID_MAX),
})

/** The id of a record: a uuid; any other text names no record. */
export const recordIdSchema: z.ZodGUID = z.guid()

/** The stages of the sales consult a customer may stand at. */
const consultStageSchema: z.ZodEnum<{
    discover: "discover"
    recommend: "recommend"
    close: "close"
    ordered: "ordered"
    after_sale: "after_sale"
}> = z.enum(["discover", "recommend", "close", "ordered", "after_sale"])

/** The most members the consult facts of a customer hold. */
const FACTS_MAX = 50

/** A JSON value the consult facts may hold: text, numbers, flags, null, and lists and records of them. */
const factValue: z.ZodType<JsonValue> = z.lazy(() =>
    z.union([
        z.string().max(NOTE_MAX),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(factValue).max(FACTS_MAX),
        z.record(z.string().max(ID_MAX), factValue).refine((entries) => Object.keys(entries).length <= FACTS_MAX),
    ]),
)

/** What `lead.update` carries: the customer, and the consult stage and facts to write. */
export interface LeadUpdate {
    /** The customer. */
    readonly leadId: string
    /** The consult stage, or undefined to keep it. */
    readonly consultStage?: z.infer<typeof consultStageSchema> | undefined
    /** The consult facts, or undefined to keep them. */
    readonly consultFacts?: { readonly [member: string]: JsonValue } | undefined
}

/** What `lead.update` carries: the customer and the consult stage and facts to write; a member left out is kept. */
export const updateSchema: z.ZodType<LeadUpdate> = z.object({
    leadId: z.string().min(1).max(ID_MAX),
    consultStage: consultStageSchema.optional(),
    consultFacts: z
        .record(z.string().max(ID_MAX), factValue)
        .refine((facts) => Object.keys(facts).length <= FACTS_MAX)
        .optional(),
})
