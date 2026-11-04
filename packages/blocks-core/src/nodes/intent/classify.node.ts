import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import type { NodeSchema } from "../node-schema.types"
import { CLASSIFY_INSTRUCTIONS } from "./classify.messages"
import { IMAGES_SHOWN_MAX, classificationOf, imagesOf, messagesOf } from "./classify.policy"
import { classifyInputSchema, classifyOutputSchema, modelReplySchema } from "./classify.schema"
import type { ClassifyInput, ClassifyOutput } from "./classify.types"
import { bilingualOf, sampleOf } from "../../messages/catalog"

/** A picture a customer sent, as the trigger of a channel wake carries it. */
const IMAGE = { name: "anh.jpg", contentType: "image/jpeg", url: "https://files.example/anh.jpg?sig=x" } as const

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
    title: bilingualOf("nodeIntentClassifyTitle"),
    params,
    input: classifyInputSchema,
    output: classifyOutputSchema,
    rights: [],
    effects: [],
    run: async (given, context) => {
        const images = imagesOf(given.messages)
        const reply = await context.model.json(modelReplySchema, {
            purpose: "intent-classify",
            instructions: CLASSIFY_INSTRUCTIONS,
            input: { messages: messagesOf(given.text) },
            images: images.slice(0, IMAGES_SHOWN_MAX).map((file) => file.url),
        })
        return classificationOf(reply, images.length, given.text)
    },
    examples: [
        {
            name: "an order, a question and a payment claim in one burst",
            params: {},
            input: {
                text: [
                    sampleOf("sampleAloDatGiumDinh1Chau"),
                    sampleOf("sampleToiCanTuVan"),
                    sampleOf("sampleToiDaChuyenKhoan5kTen"),
                ].join("\n"),
                messages: null,
            },
            model: [
                {
                    intents: ["order", "question", "payment_claim"],
                    order: {
                        items: [{ name: sampleOf("sampleChauHoa"), quantity: 1 }],
                        address: sampleOf("sample69HangXanh"),
                        customer: sampleOf("sampleDinh"),
                    },
                    payment_claim: { amount_vnd: "5k", payer_name: "BUI NGUYEN DINH" },
                },
            ],
            output: {
                intents: ["order", "question", "payment_claim"],
                order: {
                    items: [{ name: sampleOf("sampleChauHoa"), quantity: 1, priceVnd: null }],
                    address: sampleOf("sample69HangXanh"),
                    customer: sampleOf("sampleDinh"),
                },
                paymentClaim: { amountVnd: 5000, payerName: "BUI NGUYEN DINH" },
                attachment: null,
            },
            effects: [],
        },
        {
            name: "an order that names no one and gives no quantity is still an order, its missing fields null",
            params: {},
            input: { text: sampleOf("sampleChoMinhDatChauHoaGiao"), messages: null },
            model: [
                {
                    intents: ["order"],
                    order: { items: [{ name: sampleOf("sampleChauHoa") }], address: sampleOf("sample69HangXanh") },
                },
            ],
            output: {
                intents: ["order"],
                order: {
                    items: [{ name: sampleOf("sampleChauHoa"), quantity: 1, priceVnd: null }],
                    address: sampleOf("sample69HangXanh"),
                    customer: null,
                },
                paymentClaim: null,
                attachment: null,
            },
            effects: [],
        },
        {
            name: "the words after giao are the delivery address, whatever the order says before them",
            params: {},
            input: { text: sampleOf("sampleChoMinhDat1GioHoa"), messages: null },
            model: [
                {
                    intents: ["order"],
                    order: {
                        items: [{ name: sampleOf("sampleGioHoaNho"), quantity: 1 }],
                        address: sampleOf("sample25NguyenHue"),
                    },
                },
            ],
            output: {
                intents: ["order"],
                order: {
                    items: [{ name: sampleOf("sampleGioHoaNho"), quantity: 1, priceVnd: null }],
                    address: sampleOf("sample25NguyenHue"),
                    customer: null,
                },
                paymentClaim: null,
                attachment: null,
            },
            effects: [],
        },
        {
            name: "an order with no address and no name is an order with both null",
            params: {},
            input: { text: sampleOf("sampleDat2ChauHoa"), messages: null },
            model: [
                {
                    intents: ["order"],
                    order: { items: [{ name: sampleOf("sampleChauHoa"), quantity: 2 }], address: null },
                },
            ],
            output: {
                intents: ["order"],
                order: {
                    items: [{ name: sampleOf("sampleChauHoa"), quantity: 2, priceVnd: null }],
                    address: null,
                    customer: null,
                },
                paymentClaim: null,
                attachment: null,
            },
            effects: [],
        },
        {
            name: "a greeting is other",
            params: {},
            input: { text: sampleOf("sampleChaoShop"), messages: null },
            model: [{ intents: ["other"], order: null, payment_claim: null }],
            output: { intents: ["other"], order: null, paymentClaim: null, attachment: null },
            effects: [],
        },
        {
            name: "a slot the model forgot to list still raises its intent",
            params: {},
            input: { text: sampleOf("sampleChuyenKhoanRoiNha15tr"), messages: null },
            model: [{ intents: [], order: null, payment_claim: { amount_vnd: "1,5tr", payer_name: null } }],
            output: {
                intents: ["payment_claim"],
                order: null,
                paymentClaim: { amountVnd: 1_500_000, payerName: null },
                attachment: null,
            },
            effects: [],
        },
        {
            name: "a picture alone that is a transfer receipt is a payment claim with what the receipt shows",
            params: {},
            input: { text: sampleOf("sampleAnh"), messages: [{ text: sampleOf("sampleAnh"), attachments: [IMAGE] }] },
            model: [
                {
                    intents: ["other"],
                    payment_claim: { amount_vnd: 150000, payer_name: "NGUYEN VAN A" },
                    images: ["payment_receipt"],
                },
            ],
            output: {
                intents: ["payment_claim"],
                order: null,
                paymentClaim: { amountVnd: 150_000, payerName: "NGUYEN VAN A" },
                attachment: null,
            },
            effects: [],
        },
        {
            name: "a picture alone that is no receipt is an attachment, never other",
            params: {},
            input: { text: sampleOf("sampleAnh"), messages: [{ text: sampleOf("sampleAnh"), attachments: [IMAGE] }] },
            model: [{ intents: ["other"], images: ["other"] }],
            output: {
                intents: ["attachment"],
                order: null,
                paymentClaim: null,
                attachment: { count: 1, understood: true },
            },
            effects: [],
        },
        {
            name: "a picture the model cannot understand, or gave no kind for, is an attachment that was not understood",
            params: {},
            input: { text: sampleOf("sampleAnh"), messages: [{ text: sampleOf("sampleAnh"), attachments: [IMAGE] }] },
            model: [{ intents: ["other"] }],
            output: {
                intents: ["attachment"],
                order: null,
                paymentClaim: null,
                attachment: { count: 1, understood: false },
            },
            effects: [],
        },
    ],
})
