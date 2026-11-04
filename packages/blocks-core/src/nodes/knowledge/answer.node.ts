import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { NodeSchema } from "../node-schema.types"
import { PUBLIC_VISIBILITY, answerAsk, answerOf, gapAnswerOf, publicDocumentsOf } from "./answer.policy"
import { answerInputSchema, answerOutputSchema, answerParamsSchema } from "./answer.schema"
import type { AnswerInput, AnswerOutput, AnswerParams, DocumentRow } from "./answer.types"
import { bilingualOf, sampleOf } from "../../messages/catalog"

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
    title: bilingualOf("nodeKnowledgeAnswerTitle"),
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
            input: { question: sampleOf("sampleChauHoaGiaBaoNhieu"), recordedEffects: [] },
            store: {
                "knowledge-document": [
                    {
                        id: "d1",
                        title: sampleOf("sampleBangGia"),
                        body: sampleOf("sampleChauHoaNhoGia120000"),
                        visibility: "public",
                    },
                    {
                        id: "d2",
                        title: sampleOf("sampleGiaVon"),
                        body: sampleOf("sampleGiaVonChauHoa60000"),
                        visibility: "internal",
                    },
                ],
            },
            grant: { rights: [{ kind: KNOWLEDGE_KIND, access: "read", scope: "workspace", fields: DOCUMENT_FIELDS }] },
            model: [sampleOf("sampleChauHoaNhoGia1200002")],
            output: {
                reply: sampleOf("sampleChauHoaNhoGia1200002"),
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
            input: { question: sampleOf("sampleGiaoHoaCoMatPhiKhong"), recordedEffects: [] },
            store: {
                "knowledge-document": [
                    {
                        id: "d1",
                        title: sampleOf("sampleGiaoHang"),
                        body: sampleOf("sampleGiaoNoiThanhMienPhi"),
                        visibility: "public",
                    },
                ],
            },
            grant: { rights: [{ kind: KNOWLEDGE_KIND, access: "read", scope: "workspace", fields: DOCUMENT_FIELDS }] },
            model: [sampleOf("sampleGiaoNoiThanhMienPhiA")],
            output: {
                reply: sampleOf("sampleGiaoNoiThanhMienPhiA2"),
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
            input: { question: sampleOf("sampleGiamGiaChoMinh20Nhe"), recordedEffects: [] },
            store: {
                "knowledge-document": [
                    {
                        id: "d1",
                        title: sampleOf("sampleBangGia"),
                        body: sampleOf("sampleChauHoaNhoGia120000"),
                        visibility: "public",
                    },
                ],
            },
            grant: { rights: [{ kind: KNOWLEDGE_KIND, access: "read", scope: "workspace", fields: DOCUMENT_FIELDS }] },
            model: [sampleOf("sampleEmGiamGia20ChoBan")],
            output: {
                reply: sampleOf("sampleEmChuaCoThongTinVe"),
                grounded: false,
                rewritten: false,
                removedClaims: [],
                knowledgeGap: sampleOf("sampleGiamGiaChoMinh20Nhe"),
            },
            effects: [],
        },
    ],
})
