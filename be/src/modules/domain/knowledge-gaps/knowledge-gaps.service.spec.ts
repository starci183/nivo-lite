import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { GapInput } from "./knowledge-gaps.contracts"
import { KnowledgeGapsService } from "./knowledge-gaps.service"
import type { KnowledgeGapRow } from "./persistence/knowledge-gaps.rows"
import {
    ANSWER_GAP,
    BUMP_GAP,
    COUNT_OPEN_GAPS,
    COUNT_OPEN_GAPS_OF_MODULE,
    DISMISS_GAP,
    INSERT_GAP,
    SELECT_GAPS,
    SELECT_GAP_CANDIDATES,
    SELECT_OPEN_GAPS,
    SELECT_OPEN_GAPS_OF_MODULE,
} from "./persistence/knowledge-gaps.sql"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-10-12T10:00:00.000Z"

const rowOf = (changes: Partial<KnowledgeGapRow> = {}): KnowledgeGapRow => ({
    id: "g1",
    module: "chatbot",
    question: "Tea price?",
    question_key: "tea-price",
    keywords: ["tea", "price"],
    topic: "Tea",
    attribute_guess: "Price",
    count: 1,
    first_seen_at: AT,
    last_seen_at: AT,
    example_conversation_id: null,
    status: "open",
    reopened_count: 0,
    ...changes,
})

const gap = {
    id: "g1",
    module: "chatbot",
    question: "Tea price?",
    topic: "Tea",
    attributeGuess: "Price",
    count: 1,
    firstSeenAt: AT,
    lastSeenAt: AT,
    exampleConversationId: null,
    status: "open",
    reopenedCount: 0,
}

const inputOf = (changes: Partial<GapInput> = {}): GapInput => ({
    module: "chatbot",
    question: "Tea price?",
    source: "model",
    ...changes,
})

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [KnowledgeGapsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(KnowledgeGapsService)
}

describe("KnowledgeGapsService", () => {
    it("lists mapped gaps with the requested statuses and caps the limit at 200", async () => {
        const em = mockEntityManager({ query: [SELECT_GAPS, [rowOf()]] })
        const service = await build(em)

        await expect(service.list(WS, ["open", "answered"], 250)).resolves.toEqual([gap])
        await expect(service.list(WS, ["dismissed"], 10)).resolves.toEqual([gap])

        expect(em.query.mock.calls).toEqual([
            [SELECT_GAPS, [WS, ["open", "answered"], 200]],
            [SELECT_GAPS, [WS, ["dismissed"], 10]],
        ])
    })
})

describe("KnowledgeGapsService", () => {
    describe("record", () => {
        it("ignores a question without significant words before querying", async () => {
            const em = mockEntityManager()
            const service = await build(em)

            await expect(service.record(WS, inputOf({ question: " hello please how are you " }))).resolves.toBeNull()

            expect(em.query).not.toHaveBeenCalled()
        })

        it("starts a normalized question with topic parts, conversation and source", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_GAP_CANDIDATES, []],
                    [INSERT_GAP, [rowOf()]],
                ],
            })
            const service = await build(em)

            await expect(
                service.record(
                    WS,
                    inputOf({ question: "  Tea \n price?  ", topic: " Tea | Price ", conversationId: "c1" }),
                ),
            ).resolves.toEqual({ gap, isNew: true, reopened: false })

            expect(em.query.mock.calls).toEqual([
                [SELECT_GAP_CANDIDATES, [WS, "chatbot", 300]],
                [
                    INSERT_GAP,
                    [WS, "chatbot", "Tea price?", "tea-price", ["tea", "price"], "Tea", "Price", "c1", "model"],
                ],
            ])
        })

        it("caps the stored question and defaults an absent topic and conversation to null", async () => {
            const question = "t".repeat(301)
            const em = mockEntityManager({
                query: [
                    [SELECT_GAP_CANDIDATES, []],
                    [INSERT_GAP, [rowOf()]],
                ],
            })
            const service = await build(em)

            await service.record(WS, inputOf({ question, source: "retrieval" }))

            expect(em.query).toHaveBeenCalledWith(INSERT_GAP, [
                WS,
                "chatbot",
                "t".repeat(300),
                "t".repeat(120),
                ["t".repeat(120)],
                null,
                null,
                null,
                "retrieval",
            ])
        })
    })
})

describe("KnowledgeGapsService", () => {
    describe("record", () => {
        it("prefers an exact key over a similar question and reopens an answered gap", async () => {
            const em = mockEntityManager({
                query: [
                    [
                        SELECT_GAP_CANDIDATES,
                        [rowOf({ id: "similar", question_key: "tea-price-please" }), rowOf({ status: "answered" })],
                    ],
                    [BUMP_GAP, [rowOf({ count: 2, reopened_count: 1 })]],
                ],
            })
            const service = await build(em)

            await expect(service.record(WS, inputOf({ topic: "Tea | Price", conversationId: "c1" }))).resolves.toEqual({
                gap: { ...gap, count: 2, reopenedCount: 1 },
                isNew: false,
                reopened: true,
            })

            expect(em.query).toHaveBeenCalledWith(BUMP_GAP, [WS, "g1", "Tea", "Price", "c1"])
            expect(em.query).toHaveBeenCalledTimes(2)
        })

        it("matches stored significant words and falls back to the existing row when the bump returns none", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_GAP_CANDIDATES, [rowOf({ question_key: "old-key" })]],
                    [BUMP_GAP, []],
                ],
            })
            const service = await build(em)

            await expect(service.record(WS, inputOf())).resolves.toEqual({ gap, isNew: false, reopened: false })

            expect(em.query).toHaveBeenCalledWith(BUMP_GAP, [WS, "g1", null, null, null])
        })

        it("derives missing candidate keywords and skips an unrelated candidate", async () => {
            const em = mockEntityManager({
                query: [
                    [
                        SELECT_GAP_CANDIDATES,
                        [
                            rowOf({ id: "other", question_key: "coffee-stock", keywords: ["coffee", "stock"] }),
                            rowOf({ question_key: "old-key", keywords: null }),
                        ],
                    ],
                    [BUMP_GAP, [rowOf({ count: 2 })]],
                ],
            })
            const service = await build(em)

            await expect(service.record(WS, inputOf())).resolves.toEqual({
                gap: { ...gap, count: 2 },
                isNew: false,
                reopened: false,
            })
        })
    })
})

describe("KnowledgeGapsService", () => {
    describe("record", () => {
        it("counts on the competing gap when an insert loses the uniqueness race", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_GAP_CANDIDATES, []],
                    [SELECT_GAP_CANDIDATES, [rowOf()]],
                    [INSERT_GAP, []],
                    [BUMP_GAP, [rowOf({ count: 2 })]],
                ],
            })
            const service = await build(em)

            await expect(service.record(WS, inputOf())).resolves.toEqual({
                gap: { ...gap, count: 2 },
                isNew: false,
                reopened: false,
            })

            expect(em.query.mock.calls).toEqual([
                [SELECT_GAP_CANDIDATES, [WS, "chatbot", 300]],
                [INSERT_GAP, [WS, "chatbot", "Tea price?", "tea-price", ["tea", "price"], null, null, null, "model"]],
                [SELECT_GAP_CANDIDATES, [WS, "chatbot", 300]],
                [BUMP_GAP, [WS, "g1", null, null, null]],
            ])
        })

        it("returns null when both the insert and the second lookup find no gap", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_GAP_CANDIDATES, []],
                    [INSERT_GAP, []],
                ],
            })
            const service = await build(em)

            await expect(service.record(WS, inputOf())).resolves.toBeNull()

            expect(em.query).toHaveBeenCalledTimes(3)
        })
    })

    it("stamps dismissals and answers with the caller's reason", async () => {
        const em = mockEntityManager({
            query: [
                [DISMISS_GAP, []],
                [ANSWER_GAP, []],
            ],
        })
        const service = await build(em)

        await expect(service.dismiss(WS, "g1", "u1")).resolves.toBeUndefined()
        await expect(service.answer(WS, "g2", "owner")).resolves.toBeUndefined()

        expect(em.query.mock.calls).toEqual([
            [DISMISS_GAP, [WS, "g1", "u1"]],
            [ANSWER_GAP, [WS, "g2", "owner"]],
        ])
    })
})

describe("KnowledgeGapsService", () => {
    it("answers matching questions of one module in their stored order", async () => {
        const em = mockEntityManager({
            query: [
                [
                    SELECT_OPEN_GAPS,
                    [
                        rowOf({ id: "g1" }),
                        rowOf({ id: "wrong-module", module: "sales" }),
                        rowOf({ id: "wrong-question", keywords: ["coffee", "stock"] }),
                        rowOf({ id: "g2", keywords: null }),
                    ],
                ],
                [ANSWER_GAP, []],
            ],
        })
        const service = await build(em)

        await expect(
            service.resolve(WS, { text: "Tea price is 5", module: "chatbot", minimum: 0.6, by: "fact:f1" }),
        ).resolves.toBe(2)

        expect(em.query.mock.calls).toEqual([
            [SELECT_OPEN_GAPS, [WS, 300]],
            [ANSWER_GAP, [WS, "g1", "fact:f1"]],
            [ANSWER_GAP, [WS, "g2", "fact:f1"]],
        ])
    })

    it("resolves across every module and leaves uncovered questions open", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_OPEN_GAPS, [rowOf({ module: "sales" })]],
                [ANSWER_GAP, []],
            ],
        })
        const service = await build(em)

        await expect(
            service.resolve(WS, { text: "Tea price", module: null, minimum: 0.75, by: "document:d1" }),
        ).resolves.toBe(1)
        await expect(
            service.resolve(WS, { text: "coffee", module: null, minimum: 0.75, by: "document:d2" }),
        ).resolves.toBe(0)

        expect(em.query.mock.calls).toEqual([
            [SELECT_OPEN_GAPS, [WS, 300]],
            [ANSWER_GAP, [WS, "g1", "document:d1"]],
            [SELECT_OPEN_GAPS, [WS, 300]],
        ])
    })
})

describe("KnowledgeGapsService", () => {
    describe("openOfModule", () => {
        it("returns the total and mapped open gaps of the requested module with a capped limit", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_OPEN_GAPS_OF_MODULE, [rowOf()]],
                    [COUNT_OPEN_GAPS_OF_MODULE, [{ total: 7 }]],
                ],
            })
            const service = await build(em)

            await expect(service.openOfModule(WS, "chatbot", 250)).resolves.toEqual({
                openCount: 7,
                items: [gap],
            })

            expect(em.query.mock.calls).toEqual([
                [SELECT_OPEN_GAPS_OF_MODULE, [WS, "chatbot", 200]],
                [COUNT_OPEN_GAPS_OF_MODULE, [WS, "chatbot"]],
            ])
        })

        it("defaults a missing total to zero and keeps a smaller requested limit", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_OPEN_GAPS_OF_MODULE, []],
                    [COUNT_OPEN_GAPS_OF_MODULE, []],
                ],
            })
            const service = await build(em)

            await expect(service.openOfModule(WS, "sales", 10)).resolves.toEqual({ openCount: 0, items: [] })

            expect(em.query.mock.calls).toEqual([
                [SELECT_OPEN_GAPS_OF_MODULE, [WS, "sales", 10]],
                [COUNT_OPEN_GAPS_OF_MODULE, [WS, "sales"]],
            ])
        })
    })

    it("returns the open count or zero when the database returns no count row", async () => {
        const em = mockEntityManager({
            query: [
                [COUNT_OPEN_GAPS, [{ total: 7 }]],
                [COUNT_OPEN_GAPS, []],
            ],
        })
        const service = await build(em)

        await expect(service.countOpen(WS)).resolves.toBe(7)
        await expect(service.countOpen(WS)).resolves.toBe(0)

        expect(em.query.mock.calls).toEqual([
            [COUNT_OPEN_GAPS, [WS]],
            [COUNT_OPEN_GAPS, [WS]],
        ])
    })
})
