import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { NodeSchema } from "../node-schema.types"
import { PUBLIC_VISIBILITY, answerAsk, answerOf, gapAnswerOf, publicDocumentsOf } from "./answer.policy"
import { answerInputSchema, answerOutputSchema, answerParamsSchema } from "./answer.schema"
import type { AnswerInput, AnswerOutput, AnswerParams, DocumentRow } from "./answer.types"

/** The data kind of the public brain: the documents the owner wrote, each public or internal. */
export const KNOWLEDGE_KIND = "knowledge-document"

const DOCUMENT_FIELDS = ["id", "title", "body", "visibility"] as const
const DOCUMENT_LIMIT = 20

/**
 * `knowledge.answer`: answers a customer question only from the public documents of the brain. It promises no discount and no
 * unrecorded action: a price or discount the documents do not write turns the answer into a knowledge gap, and a sentence that claims
 * an action the turn did not do is taken out, leaving a neutral reply.
 */
export const knowledgeAnswerNode: NodeDefinition<
    NodeSchema<AnswerInput>,
    NodeSchema<AnswerOutput>,
    NodeSchema<AnswerParams>
> = defineNode({
    id: "knowledge.answer",
    role: "execute",
    title: { vi: "Trả lời từ tri thức công khai", en: "Answer from the public knowledge" },
    params: answerParamsSchema,
    input: answerInputSchema,
    output: answerOutputSchema,
    rights: [{ kind: KNOWLEDGE_KIND, access: "read", scope: "workspace", fields: DOCUMENT_FIELDS }],
    effects: [],
    run: async (given, context) => {
        const rows = await context.data.read<DocumentRow>(KNOWLEDGE_KIND, {
            where: { visibility: PUBLIC_VISIBILITY },
            fields: DOCUMENT_FIELDS,
            limit: DOCUMENT_LIMIT,
        })
        const documents = publicDocumentsOf(rows)
        if (documents.length === 0) return gapAnswerOf(given, context.params)
        const text = await context.model.text(answerAsk(given.question, documents))
        return answerOf(text, documents, given, context.params)
    },
    examples: [
        {
            name: "answers from a public document",
            params: { locale: "vi", claims: null },
            input: { question: "Chậu hoa giá bao nhiêu?", recordedEffects: [] },
            store: {
                "knowledge-document": [
                    { id: "d1", title: "Bảng giá", body: "Chậu hoa nhỏ giá 120.000 đồng.", visibility: "public" },
                    { id: "d2", title: "Giá vốn", body: "Giá vốn chậu hoa 60.000 đồng.", visibility: "internal" },
                ],
            },
            grant: { rights: [{ kind: KNOWLEDGE_KIND, access: "read", scope: "workspace", fields: DOCUMENT_FIELDS }] },
            model: ["Chậu hoa nhỏ giá 120.000 đồng ạ."],
            output: {
                reply: "Chậu hoa nhỏ giá 120.000 đồng ạ.",
                grounded: true,
                rewritten: false,
                removedClaims: [],
                knowledgeGap: null,
            },
            effects: [],
        },
        {
            name: "takes out a sentence that claims an order the turn did not record",
            params: { locale: "vi", claims: null },
            input: { question: "Giao hoa có mất phí không?", recordedEffects: [] },
            store: {
                "knowledge-document": [
                    { id: "d1", title: "Giao hàng", body: "Giao nội thành miễn phí.", visibility: "public" },
                ],
            },
            grant: { rights: [{ kind: KNOWLEDGE_KIND, access: "read", scope: "workspace", fields: DOCUMENT_FIELDS }] },
            model: ["Giao nội thành miễn phí ạ. Em đã ghi nhận đơn của bạn."],
            output: {
                reply: "Giao nội thành miễn phí ạ.",
                grounded: true,
                rewritten: true,
                removedClaims: ["order-recorded"],
                knowledgeGap: null,
            },
            effects: [],
        },
        {
            name: "a discount the documents do not write is a knowledge gap",
            params: { locale: "vi", claims: null },
            input: { question: "Giảm giá cho mình 20% nhé", recordedEffects: [] },
            store: {
                "knowledge-document": [
                    { id: "d1", title: "Bảng giá", body: "Chậu hoa nhỏ giá 120.000 đồng.", visibility: "public" },
                ],
            },
            grant: { rights: [{ kind: KNOWLEDGE_KIND, access: "read", scope: "workspace", fields: DOCUMENT_FIELDS }] },
            model: ["Em giảm giá 20% cho bạn ạ."],
            output: {
                reply: "Em chưa có thông tin về nội dung này ạ.",
                grounded: false,
                rewritten: false,
                removedClaims: [],
                knowledgeGap: "Giảm giá cho mình 20% nhé",
            },
            effects: [],
        },
    ],
})
