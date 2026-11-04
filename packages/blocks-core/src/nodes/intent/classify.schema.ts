import { z } from "zod"
import type { NodeSchema } from "../node-schema.types"
import type {
    AttachmentSlot,
    ClassifyInput,
    ClassifyOutput,
    ImageKind,
    Intent,
    ModelReply,
    OrderSlot,
    PaymentClaimSlot,
    TriggerFile,
    TriggerMessage,
} from "./classify.types"
import { MAX_LINE } from "../../bounds"

const TEXT_MAX = 8000
const NAME_MAX = 200
const ADDRESS_MAX = 500
const ITEMS_MAX = 100
const QUANTITY_MAX = 10_000
const INTENTS_MAX = 5
const MESSAGES_MAX = 100
const FILES_MAX = 20
const URL_MAX = 2000

/** The intents a batch can raise. */
export const intentSchema: NodeSchema<Intent> = z.enum(["question", "order", "payment_claim", "attachment", "other"])

const fileSchema: NodeSchema<TriggerFile> = z.object({
    name: z.string().max(NAME_MAX),
    contentType: z.string().max(NAME_MAX),
    url: z.string().max(URL_MAX),
})

const messageSchema: NodeSchema<TriggerMessage> = z.object({
    text: z.string().max(TEXT_MAX),
    attachments: z.array(fileSchema).max(FILES_MAX),
})

/** The input: the pending messages, one per line, and each with its files when the trigger carries them. */
export const classifyInputSchema: NodeSchema<ClassifyInput> = z.object({
    text: z.string().min(1).max(TEXT_MAX),
    messages: z.array(messageSchema).max(MESSAGES_MAX).nullable(),
})

const orderSlotSchema: NodeSchema<OrderSlot> = z.object({
    items: z
        .array(
            z.object({
                name: z.string().min(1).max(NAME_MAX),
                quantity: z.number().int().min(1).max(QUANTITY_MAX),
                priceVnd: z.number().min(0).nullable(),
            }),
        )
        .max(ITEMS_MAX),
    address: z.string().max(ADDRESS_MAX).nullable(),
    customer: z.string().max(NAME_MAX).nullable(),
})

const paymentClaimSlotSchema: NodeSchema<PaymentClaimSlot> = z.object({
    amountVnd: z.number().int().min(1).nullable(),
    payerName: z.string().max(NAME_MAX).nullable(),
})

const attachmentSlotSchema: NodeSchema<AttachmentSlot> = z.object({
    count: z
        .number()
        .int()
        .min(1)
        .max(FILES_MAX * MESSAGES_MAX),
    understood: z.boolean(),
})

/** The output: the intents and their slots. */
export const classifyOutputSchema: NodeSchema<ClassifyOutput> = z.object({
    intents: z.array(intentSchema).min(1).max(INTENTS_MAX),
    order: orderSlotSchema.nullable(),
    paymentClaim: paymentClaimSlotSchema.nullable(),
    attachment: attachmentSlotSchema.nullable(),
})

const imageKindSchema: NodeSchema<ImageKind> = z.enum(["payment_receipt", "other", "unreadable"])

/**
 * The JSON the model answers with. What the customer did not say may be absent or null in any slot: it is never a failure here, the
 * policy turns it into null and the Sales nodes ask the customer for what is missing.
 */
export const modelReplySchema: NodeSchema<ModelReply, unknown> = z.object({
    intents: z
        .array(intentSchema)
        .max(INTENTS_MAX * 2)
        .default([]),
    order: z
        .looseObject({
            items: z
                .array(z.object({ name: z.string().max(MAX_LINE), quantity: z.number().nullish() }))
                .max(ITEMS_MAX)
                .default([]),
            address: z.string().max(MAX_LINE).nullish(),
            customer: z.string().max(MAX_LINE).nullish(),
        })
        .nullish(),
    payment_claim: z
        .object({
            amount_vnd: z.union([z.number(), z.string().max(MAX_LINE)]).nullish(),
            payer_name: z.string().max(MAX_LINE).nullish(),
        })
        .nullish(),
    images: z
        .array(imageKindSchema)
        .max(FILES_MAX * MESSAGES_MAX)
        .default([]),
})
