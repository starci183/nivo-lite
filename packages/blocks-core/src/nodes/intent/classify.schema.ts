import { z } from "zod"
import type { NodeSchema } from "../node-schema.types"
import type { ClassifyInput, ClassifyOutput, Intent, ModelReply, OrderSlot, PaymentClaimSlot } from "./classify.types"

const TEXT_MAX = 8000
const NAME_MAX = 200
const ADDRESS_MAX = 500
const ITEMS_MAX = 100
const QUANTITY_MAX = 10_000
const INTENTS_MAX = 4

const intentSchema: NodeSchema<Intent> = z.enum(["question", "order", "payment_claim", "other"])

/** The input: the pending messages, one per line. */
export const classifyInputSchema: NodeSchema<ClassifyInput> = z.object({ text: z.string().min(1).max(TEXT_MAX) })

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

/** The output: the intents and their slots. */
export const classifyOutputSchema: NodeSchema<ClassifyOutput> = z.object({
    intents: z.array(intentSchema).min(1).max(INTENTS_MAX),
    order: orderSlotSchema.nullable(),
    paymentClaim: paymentClaimSlotSchema.nullable(),
})

/** The JSON the model answers with. */
export const modelReplySchema: NodeSchema<ModelReply> = z.object({
    intents: z.array(intentSchema).max(INTENTS_MAX * 2),
    order: z
        .object({
            items: z.array(z.object({ name: z.string(), quantity: z.number().nullable() })).max(ITEMS_MAX),
            address: z.string().nullable(),
            customer: z.string().nullable(),
        })
        .nullable(),
    payment_claim: z
        .object({ amount_vnd: z.union([z.number(), z.string()]).nullable(), payer_name: z.string().nullable() })
        .nullable(),
})
