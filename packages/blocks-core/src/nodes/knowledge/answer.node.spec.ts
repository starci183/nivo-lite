import { expectedEffects, runExample } from "../node-examples.fixture"
import { knowledgeAnswerNode } from "./answer.node"
import { publicDocumentsOf } from "./answer.policy"
import { guardClaims, plainOf } from "./claims.policy"
import { amountsIn, hasInventedFigure } from "./figures.policy"

const [priced, ...others] = knowledgeAnswerNode.examples
const BASE = priced

describe("knowledge.answer", () => {
    it.each([priced, ...others].map((example) => [example.name, example] as const))(
        "example: %s",
        async (_name, example) => {
            const run = await runExample(knowledgeAnswerNode, example)
            expect(run.output).toEqual(example.output)
            expect(run.effects).toEqual(expectedEffects(example))
        },
    )

    it("is a gap, with no model call, when the store holds no public document", async () => {
        const run = await runExample(knowledgeAnswerNode, {
            ...BASE,
            store: { "knowledge-document": [{ id: "d2", title: "t", body: "b", visibility: "internal" }] },
            model: [],
        })
        expect(run.output).toEqual({
            reply: "Em chưa có thông tin về nội dung này ạ.",
            grounded: false,
            rewritten: false,
            removedClaims: [],
            knowledgeGap: "Chậu hoa giá bao nhiêu?",
        })
    })

    it("is a gap when the model finds no answer, and in English when the graph says so", async () => {
        const run = await runExample(knowledgeAnswerNode, {
            ...BASE,
            params: { locale: "en", claims: null },
            model: ["NO_ANSWER"],
        })
        expect(run.output).toMatchObject({ reply: "I do not have information on this yet.", grounded: false })
    })

    it("is a gap when the model answers nothing", async () => {
        const run = await runExample(knowledgeAnswerNode, { ...BASE, model: ["   "] })
        expect(run.output).toMatchObject({ grounded: false, knowledgeGap: "Chậu hoa giá bao nhiêu?" })
    })

    it("is a gap when the reply names a price the documents do not write", async () => {
        const run = await runExample(knowledgeAnswerNode, { ...BASE, model: ["Chậu hoa giá 99.000 đồng ạ."] })
        expect(run.output).toMatchObject({ grounded: false })
    })

    it("lets a claim through when the turn recorded its effect", async () => {
        const run = await runExample(knowledgeAnswerNode, {
            ...BASE,
            input: { question: "Đơn của mình?", recordedEffects: ["order.record"] },
            model: ["Em đã ghi nhận đơn của bạn ạ."],
        })
        expect(run.output).toMatchObject({ reply: "Em đã ghi nhận đơn của bạn ạ.", rewritten: false })
    })

    it("answers neutrally when every sentence claimed an action the turn did not do", async () => {
        const run = await runExample(knowledgeAnswerNode, {
            ...BASE,
            model: ["Em đã nhận được tiền của bạn. Thanh toán thành công."],
        })
        expect(run.output).toEqual({
            reply: "Em đã nhận được tin nhắn của bạn ạ.",
            grounded: true,
            rewritten: true,
            removedClaims: ["payment-received"],
            knowledgeGap: null,
        })
    })

    it("uses the claim rules of the graph instead of the default ones", async () => {
        const run = await runExample(knowledgeAnswerNode, {
            ...BASE,
            params: {
                locale: "en",
                claims: [{ id: "gift", requires: "gift.send", phrases: { vi: [], en: ["gift is on its way"] } }],
            },
            model: ["Your gift is on its way. Order recorded."],
        })
        expect(run.output).toMatchObject({
            reply: "Order recorded.",
            rewritten: true,
            removedClaims: ["gift"],
        })
    })
})

describe("publicDocumentsOf", () => {
    it("keeps only public rows even when the store hands back others", () => {
        const rows = [
            { id: "a", title: "A", body: "a", visibility: "public" },
            { id: "b", title: "B", body: "b", visibility: "internal" },
        ]
        expect(publicDocumentsOf(rows).map((row) => row.id)).toEqual(["a"])
    })
})

describe("claims.policy", () => {
    it("matches a phrase without accents or case", () => {
        expect(plainOf("  Đã   Ghi nhận ĐƠN ")).toBe("da ghi nhan don")
        const rules = [{ id: "r", requires: "x.y", phrases: { vi: ["đã ghi nhận đơn"], en: [] } }]
        expect(guardClaims("Em DA GHI NHAN DON roi.\nCam on ban.", rules, [], "vi")).toEqual({
            kept: ["Cam on ban."],
            removed: ["r"],
        })
    })
})

describe("figures.policy", () => {
    it("reads amounts in every written form", () => {
        expect(
            [...amountsIn("5 triệu, 1,5tr, 500k, 200 nghìn, 5.000.000 đồng, 12345, 20 chậu")].sort((a, b) => a - b),
        ).toEqual([200_000, 500_000, 1_500_000, 5_000_000, 12_345].sort((a, b) => a - b))
    })

    it("flags a discount percentage the documents do not write, and accepts one they do", () => {
        expect(hasInventedFigure("Giảm 10% cho bạn", "Giảm 10% cho đơn đầu")).toBe(false)
        expect(hasInventedFigure("Giảm 15% cho bạn", "Giảm 10% cho đơn đầu")).toBe(true)
        expect(hasInventedFigure("Tỷ lệ hài lòng 99%", "Không có số")).toBe(false)
    })
})
