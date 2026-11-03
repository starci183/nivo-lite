import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import type { NodeSchema } from "../node-schema.types"
import { CLASSIFY_INSTRUCTIONS } from "./classify.messages"
import { classificationOf } from "./classify.policy"
import { classifyInputSchema, classifyOutputSchema, modelReplySchema } from "./classify.schema"
import type { ClassifyInput, ClassifyOutput } from "./classify.types"

type NoParams = Record<string, never>

const params: NodeSchema<NoParams> = z.strictObject({})

/** `intent.classify`: an AI call over the batch of pending customer messages; says which intents they raise and fills the order and payment claim slots. */
export const intentClassifyNode: NodeDefinition<
    NodeSchema<ClassifyInput>,
    NodeSchema<ClassifyOutput>,
    NodeSchema<NoParams>
> = defineNode({
    id: "intent.classify",
    role: "execute",
    title: { vi: "Phân loại ý định", en: "Classify the intent" },
    params,
    input: classifyInputSchema,
    output: classifyOutputSchema,
    rights: [],
    effects: [],
    run: async (given, context) => {
        const reply = await context.model.json(modelReplySchema, {
            purpose: "intent-classify",
            instructions: CLASSIFY_INSTRUCTIONS,
            input: { messages: given.text.split("\n").filter((line) => line.trim() !== "") },
        })
        return classificationOf(reply)
    },
    examples: [
        {
            name: "an order, a question and a payment claim in one burst",
            params: {},
            input: {
                text: [
                    "Alo, đặt giùm Định 1 chậu hoa, giao tới địa chỉ 69 Hàng Xanh",
                    "Tôi cần tư vấn",
                    "Tôi đã chuyển khoản 5k, tên BUI NGUYEN DINH",
                ].join("\n"),
            },
            model: [
                {
                    intents: ["order", "question", "payment_claim"],
                    order: { items: [{ name: "chậu hoa", quantity: 1 }], address: "69 Hàng Xanh", customer: "Định" },
                    payment_claim: { amount_vnd: "5k", payer_name: "BUI NGUYEN DINH" },
                },
            ],
            output: {
                intents: ["order", "question", "payment_claim"],
                order: {
                    items: [{ name: "chậu hoa", quantity: 1, priceVnd: null }],
                    address: "69 Hàng Xanh",
                    customer: "Định",
                },
                paymentClaim: { amountVnd: 5000, payerName: "BUI NGUYEN DINH" },
            },
            effects: [],
        },
        {
            name: "a greeting is other",
            params: {},
            input: { text: "Chào shop" },
            model: [{ intents: ["other"], order: null, payment_claim: null }],
            output: { intents: ["other"], order: null, paymentClaim: null },
            effects: [],
        },
        {
            name: "a slot the model forgot to list still raises its intent",
            params: {},
            input: { text: "Chuyển khoản rồi nha, 1,5tr" },
            model: [{ intents: [], order: null, payment_claim: { amount_vnd: "1,5tr", payer_name: null } }],
            output: {
                intents: ["payment_claim"],
                order: null,
                paymentClaim: { amountVnd: 1_500_000, payerName: null },
            },
            effects: [],
        },
    ],
})
