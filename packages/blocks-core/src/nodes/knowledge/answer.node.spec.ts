import { nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import { coreEffects } from "../../vocabulary/effects"
import { knowledgeAnswerNode } from "./answer.node"
import { publicDocumentsOf } from "./answer.policy"
import { guardClaims, plainOf } from "./claims.policy"
import { amountsIn, hasInventedFigure } from "./figures.policy"

const [priced] = knowledgeAnswerNode.examples
const KEPT_GAP = (question: string, locale: "vi" | "en" = "vi") => ({
    reply: locale === "vi" ? "Em chưa có thông tin về nội dung này ạ." : "I do not have information on this yet.",
    grounded: false,
    rewritten: false,
    removedClaims: [] as Array<string>,
    knowledgeGap: question,
})

/** The mismatches of the priced example changed by what a test sets. */
const mismatchesOf = (change: Partial<typeof priced>): Promise<ReadonlyArray<string>> =>
    nodeExampleMismatches(knowledgeAnswerNode, { ...priced, ...change }, coreEffects)

describe("knowledge.answer", () => {
    it.each(knowledgeAnswerNode.examples.map((each) => [each.name, each] as const))(
        "example: %s",
        async (_name, each) => {
            await expect(nodeExampleMismatches(knowledgeAnswerNode, each, coreEffects)).resolves.toEqual([])
        },
    )

    it("is a gap, with no model call, when the store holds no public document", async () => {
        await expect(
            mismatchesOf({
                store: { "knowledge-document": [{ id: "d2", title: "t", body: "b", visibility: "internal" }] },
                model: [],
                output: KEPT_GAP("Chậu hoa giá bao nhiêu?"),
            }),
        ).resolves.toEqual([])
    })

    it("is a gap when the model finds no answer, and in English when the graph says so", async () => {
        await expect(
            mismatchesOf({
                params: { locale: "en", claims: null },
                model: ["NO_ANSWER"],
                output: KEPT_GAP("Chậu hoa giá bao nhiêu?", "en"),
            }),
        ).resolves.toEqual([])
    })

    it("is a gap when the model answers nothing, or names a price the documents do not write", async () => {
        for (const text of ["   ", "Chậu hoa giá 99.000 đồng ạ."])
            await expect(mismatchesOf({ model: [text], output: KEPT_GAP("Chậu hoa giá bao nhiêu?") })).resolves.toEqual(
                [],
            )
    })

    it("lets a claim through when the turn recorded its effect", async () => {
        await expect(
            mismatchesOf({
                input: { question: "Đơn của mình?", recordedEffects: ["order.record"] },
                model: ["Em đã ghi nhận đơn của bạn ạ."],
                output: {
                    reply: "Em đã ghi nhận đơn của bạn ạ.",
                    grounded: true,
                    rewritten: false,
                    removedClaims: [],
                    knowledgeGap: null,
                },
            }),
        ).resolves.toEqual([])
    })

    it("answers neutrally when every sentence claimed an action the turn did not do", async () => {
        await expect(
            mismatchesOf({
                model: ["Em đã nhận được tiền của bạn. Thanh toán thành công."],
                output: {
                    reply: "Em đã nhận được tin nhắn của bạn ạ.",
                    grounded: true,
                    rewritten: true,
                    removedClaims: ["payment-received"],
                    knowledgeGap: null,
                },
            }),
        ).resolves.toEqual([])
    })

    it("uses the claim rules of the graph instead of the default ones", async () => {
        await expect(
            mismatchesOf({
                params: {
                    locale: "en",
                    claims: [{ id: "gift", requires: "gift.send", phrases: { vi: [], en: ["gift is on its way"] } }],
                },
                model: ["Your gift is on its way. Order recorded."],
                output: {
                    reply: "Order recorded.",
                    grounded: true,
                    rewritten: true,
                    removedClaims: ["gift"],
                    knowledgeGap: null,
                },
            }),
        ).resolves.toEqual([])
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
