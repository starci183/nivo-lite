import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import { In, Not } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { GapInput } from "./knowledge-gaps.contracts"
import { KnowledgeGapsService } from "./knowledge-gaps.service"
import { KnowledgeGapEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = new Date("2026-10-12T10:00:00.000Z")

const rowOf = builder<KnowledgeGapEntity>({
    id: "g1",
    workspaceId: WS,
    module: "chatbot",
    question: "Tea price?",
    questionKey: "tea-price",
    keywords: ["tea", "price"],
    topic: "Tea",
    attributeGuess: "Price",
    count: 1,
    firstSeenAt: AT,
    lastSeenAt: AT,
    exampleConversationId: null,
    source: "model",
    status: "open",
    answeredAt: null,
    answeredBy: null,
    dismissedAt: null,
    dismissedBy: null,
    reopenedCount: 0,
    updatedAt: AT,
})

/** Hands a literal to an expectation as a plain object, so it is not mistaken for a hand-built entity row. */
const plain = (value: object): object => value

const gap = {
    id: "g1",
    module: "chatbot",
    question: "Tea price?",
    topic: "Tea",
    attributeGuess: "Price",
    count: 1,
    firstSeenAt: AT.toISOString(),
    lastSeenAt: AT.toISOString(),
    exampleConversationId: null,
    status: "open",
    reopenedCount: 0,
}

const CANDIDATES_QUERY = (module = "chatbot") => [
    KnowledgeGapEntity,
    { where: { workspaceId: WS, module }, order: { lastSeenAt: "DESC" }, take: 300 },
]
const NOW: unknown = expect.any(Function)

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

const INSERTED = (row: KnowledgeGapEntity) => ({ execute: { raw: [row] } })
const NOTHING = { execute: { raw: [] } }

const BUMP_SET = {
    count: NOW,
    lastSeenAt: NOW,
    updatedAt: NOW,
    topic: NOW,
    attributeGuess: NOW,
    exampleConversationId: NOW,
    status: NOW,
    answeredAt: NOW,
    answeredBy: NOW,
    reopenedCount: NOW,
}

const BUMP_WHERE = ["workspace_id = :workspaceId AND id = :id", { workspaceId: WS, id: "g1" }]

const nullKeywords = null as unknown as Array<string>

describe("KnowledgeGapsService", () => {
    it("lists mapped gaps with the requested statuses and caps the limit at 200", async () => {
        const em = mockEntityManager({ find: [KnowledgeGapEntity, [rowOf()]] })
        const service = await build(em)

        await expect(service.list(WS, ["open", "answered"], 250)).resolves.toEqual([gap])
        await expect(service.list(WS, ["dismissed"], 10)).resolves.toEqual([gap])

        expect(em.find.mock.calls).toEqual([
            [
                KnowledgeGapEntity,
                {
                    where: { workspaceId: WS, status: In(["open", "answered"]) },
                    order: { count: "DESC", lastSeenAt: "DESC" },
                    take: 200,
                },
            ],
            [
                KnowledgeGapEntity,
                plain({
                    where: { workspaceId: WS, status: In(["dismissed"]) },
                    order: { count: "DESC", lastSeenAt: "DESC" },
                    take: 10,
                }),
            ],
        ])
    })
})

describe("KnowledgeGapsService", () => {
    describe("record", () => {
        it("ignores a question without significant words before querying", async () => {
            const em = mockEntityManager()
            const service = await build(em)

            await expect(service.record(WS, inputOf({ question: " hello please how are you " }))).resolves.toBeNull()

            expect(em.find).not.toHaveBeenCalled()
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("starts a normalized question with topic parts, conversation and source", async () => {
            const em = mockEntityManager({ find: [KnowledgeGapEntity, []] })
            const [insert] = queueQueryBuilders(em, [INSERTED(rowOf())])
            const service = await build(em)

            await expect(
                service.record(
                    WS,
                    inputOf({ question: "  Tea \n price?  ", topic: " Tea | Price ", conversationId: "c1" }),
                ),
            ).resolves.toEqual({ gap, isNew: true, reopened: false })

            expect(em.find.mock.calls).toEqual([CANDIDATES_QUERY()])
            expect(insert?.callsOf("insert")).toEqual([[]])
            expect(insert?.callsOf("values")).toEqual([
                [
                    {
                        workspaceId: WS,
                        module: "chatbot",
                        question: "Tea price?",
                        questionKey: "tea-price",
                        keywords: ["tea", "price"],
                        topic: "Tea",
                        attributeGuess: "Price",
                        exampleConversationId: "c1",
                        source: "model",
                    },
                ],
            ])
            expect(insert?.callsOf("orIgnore")).toHaveLength(1)
            expect(insert?.callsOf("returning")).toHaveLength(1)
        })

        it("caps the stored question and defaults an absent topic and conversation to null", async () => {
            const question = "t".repeat(301)
            const em = mockEntityManager({ find: [KnowledgeGapEntity, []] })
            const [insert] = queueQueryBuilders(em, [INSERTED(rowOf())])
            const service = await build(em)

            await service.record(WS, inputOf({ question, source: "retrieval" }))

            expect(insert?.callsOf("values")).toEqual([
                [
                    {
                        workspaceId: WS,
                        module: "chatbot",
                        question: "t".repeat(300),
                        questionKey: "t".repeat(120),
                        keywords: ["t".repeat(120)],
                        topic: null,
                        attributeGuess: null,
                        exampleConversationId: null,
                        source: "retrieval",
                    },
                ],
            ])
        })
    })
})

describe("KnowledgeGapsService", () => {
    describe("record", () => {
        it("prefers an exact key over a similar question and reopens an answered gap", async () => {
            const em = mockEntityManager({
                find: [
                    KnowledgeGapEntity,
                    [
                        Object.assign(rowOf(), { id: "similar", questionKey: "tea-price-please" }),
                        Object.assign(rowOf(), { status: "answered" }),
                    ],
                ],
            })
            const [bump] = queueQueryBuilders(em, [INSERTED(Object.assign(rowOf(), { count: 2, reopenedCount: 1 }))])
            const service = await build(em)

            await expect(service.record(WS, inputOf({ topic: "Tea | Price", conversationId: "c1" }))).resolves.toEqual({
                gap: { ...gap, count: 2, reopenedCount: 1 },
                isNew: false,
                reopened: true,
            })

            expect(bump?.callsOf("update")).toEqual([[]])
            expect(bump?.callsOf("set")).toEqual([[BUMP_SET]])
            expect(bump?.callsOf("where")).toEqual([BUMP_WHERE])
            expect(bump?.callsOf("setParameters")).toEqual([
                [{ subject: "Tea", attribute: "Price", conversationId: "c1" }],
            ])
            expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
        })

        it("matches stored significant words and falls back to the existing row when the bump returns none", async () => {
            const em = mockEntityManager({
                find: [KnowledgeGapEntity, [Object.assign(rowOf(), { questionKey: "old-key" })]],
            })
            const [bump] = queueQueryBuilders(em, [NOTHING])
            const service = await build(em)

            await expect(service.record(WS, inputOf())).resolves.toEqual({ gap, isNew: false, reopened: false })

            expect(bump?.callsOf("setParameters")).toEqual([[{ subject: null, attribute: null, conversationId: null }]])
        })

        it("derives missing candidate keywords and skips an unrelated candidate", async () => {
            const em = mockEntityManager({
                find: [
                    KnowledgeGapEntity,
                    [
                        Object.assign(rowOf(), {
                            id: "other",
                            questionKey: "coffee-stock",
                            keywords: ["coffee", "stock"],
                        }),
                        Object.assign(rowOf(), { questionKey: "old-key", keywords: nullKeywords }),
                    ],
                ],
            })
            queueQueryBuilders(em, [INSERTED(Object.assign(rowOf(), { count: 2 }))])
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
                find: [
                    [KnowledgeGapEntity, []],
                    [KnowledgeGapEntity, [rowOf()]],
                ],
            })
            const [insert, bump] = queueQueryBuilders(em, [NOTHING, INSERTED(Object.assign(rowOf(), { count: 2 }))])
            const service = await build(em)

            await expect(service.record(WS, inputOf())).resolves.toEqual({
                gap: { ...gap, count: 2 },
                isNew: false,
                reopened: false,
            })

            expect(em.find.mock.calls).toEqual([CANDIDATES_QUERY(), CANDIDATES_QUERY()])
            expect(insert?.callsOf("orIgnore")).toHaveLength(1)
            expect(bump?.callsOf("where")).toEqual([BUMP_WHERE])
        })

        it("returns null when both the insert and the second lookup find no gap", async () => {
            const em = mockEntityManager({ find: [KnowledgeGapEntity, []] })
            queueQueryBuilders(em, [NOTHING])
            const service = await build(em)

            await expect(service.record(WS, inputOf())).resolves.toBeNull()

            expect(em.find).toHaveBeenCalledTimes(2)
            expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
        })
    })

    it("stamps dismissals and answers with the caller's reason", async () => {
        const em = mockEntityManager({ update: [KnowledgeGapEntity, {}] })
        const service = await build(em)

        await expect(service.dismiss(WS, "g1", "u1")).resolves.toBeUndefined()
        await expect(service.answer(WS, "g2", "owner")).resolves.toBeUndefined()

        expect(em.update.mock.calls).toEqual([
            [
                KnowledgeGapEntity,
                plain({ workspaceId: WS, id: "g1", status: Not("answered") }),
                plain({ status: "dismissed", dismissedAt: NOW, dismissedBy: "u1", updatedAt: NOW }),
            ],
            [
                KnowledgeGapEntity,
                plain({ workspaceId: WS, id: "g2", status: "open" }),
                plain({ status: "answered", answeredAt: NOW, answeredBy: "owner", updatedAt: NOW }),
            ],
        ])
    })
})

const OPEN_QUERY = [
    KnowledgeGapEntity,
    plain({
        select: { id: true, module: true, keywords: true, question: true },
        where: { workspaceId: WS, status: "open" },
        take: 300,
    }),
]

const ANSWERED = (id: string, by: string) => [
    KnowledgeGapEntity,
    plain({ workspaceId: WS, id, status: "open" }),
    plain({ status: "answered", answeredAt: NOW, answeredBy: by, updatedAt: NOW }),
]

describe("KnowledgeGapsService", () => {
    it("answers matching questions of one module in their stored order", async () => {
        const em = mockEntityManager({
            find: [
                KnowledgeGapEntity,
                [
                    Object.assign(rowOf(), { id: "g1" }),
                    Object.assign(rowOf(), { id: "wrong-module", module: "sales" }),
                    Object.assign(rowOf(), { id: "wrong-question", keywords: ["coffee", "stock"] }),
                    Object.assign(rowOf(), { id: "g2", keywords: nullKeywords }),
                ],
            ],
            update: [KnowledgeGapEntity, {}],
        })
        const service = await build(em)

        await expect(
            service.resolve(WS, { text: "Tea price is 5", module: "chatbot", minimum: 0.6, by: "fact:f1" }),
        ).resolves.toBe(2)

        expect(em.find.mock.calls).toEqual([OPEN_QUERY])
        expect(em.update.mock.calls).toEqual([ANSWERED("g1", "fact:f1"), ANSWERED("g2", "fact:f1")])
    })

    it("resolves across every module and leaves uncovered questions open", async () => {
        const em = mockEntityManager({
            find: [KnowledgeGapEntity, [Object.assign(rowOf(), { module: "sales" })]],
            update: [KnowledgeGapEntity, {}],
        })
        const service = await build(em)

        await expect(
            service.resolve(WS, { text: "Tea price", module: null, minimum: 0.75, by: "document:d1" }),
        ).resolves.toBe(1)
        await expect(
            service.resolve(WS, { text: "coffee", module: null, minimum: 0.75, by: "document:d2" }),
        ).resolves.toBe(0)

        expect(em.find.mock.calls).toEqual([OPEN_QUERY, OPEN_QUERY])
        expect(em.update.mock.calls).toEqual([ANSWERED("g1", "document:d1")])
    })
})

describe("KnowledgeGapsService", () => {
    describe("openOfModule", () => {
        it("returns the total and mapped open gaps of the requested module with a capped limit", async () => {
            const em = mockEntityManager({ find: [KnowledgeGapEntity, [rowOf()]], count: [KnowledgeGapEntity, 7] })
            const service = await build(em)

            await expect(service.openOfModule(WS, "chatbot", 250)).resolves.toEqual({
                openCount: 7,
                items: [gap],
            })

            expect(em.find.mock.calls).toEqual([
                [
                    KnowledgeGapEntity,
                    plain({
                        where: { workspaceId: WS, module: "chatbot", status: "open" },
                        order: { count: "DESC", lastSeenAt: "DESC" },
                        take: 200,
                    }),
                ],
            ])
            expect(em.count.mock.calls).toEqual([
                [KnowledgeGapEntity, plain({ where: { workspaceId: WS, module: "chatbot", status: "open" } })],
            ])
        })

        it("defaults a missing total to zero and keeps a smaller requested limit", async () => {
            const em = mockEntityManager({ find: [KnowledgeGapEntity, []], count: [KnowledgeGapEntity, 0] })
            const service = await build(em)

            await expect(service.openOfModule(WS, "sales", 10)).resolves.toEqual({ openCount: 0, items: [] })

            expect(em.find.mock.calls[0]?.[1]).toMatchObject({ take: 10 })
        })
    })

    it("returns the open count or zero when the database returns no count row", async () => {
        const em = mockEntityManager({
            count: [
                [KnowledgeGapEntity, 7],
                [KnowledgeGapEntity, 0],
            ],
        })
        const service = await build(em)

        await expect(service.countOpen(WS)).resolves.toBe(7)
        await expect(service.countOpen(WS)).resolves.toBe(0)

        expect(em.count.mock.calls).toEqual([
            [KnowledgeGapEntity, plain({ where: { workspaceId: WS, status: "open" } })],
            [KnowledgeGapEntity, plain({ where: { workspaceId: WS, status: "open" } })],
        ])
    })
})
