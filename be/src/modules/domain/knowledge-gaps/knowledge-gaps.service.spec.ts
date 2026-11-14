import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
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
    keywords: [],
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
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
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

/** What each expression of the counting statement writes. */
const BUMP_SQL = {
    count: "count + 1",
    lastSeenAt: "now()",
    topic: "coalesce(topic, :subject)",
    attributeGuess: "coalesce(attribute_guess, :attribute)",
    exampleConversationId: "coalesce(example_conversation_id, CAST(:conversationId AS uuid))",
    status: "CASE WHEN status = 'answered' THEN 'open' ELSE status END",
    answeredAt: "CASE WHEN status = 'answered' THEN NULL ELSE answered_at END",
    answeredBy: "CASE WHEN status = 'answered' THEN NULL ELSE answered_by END",
    reopenedCount: "CASE WHEN status = 'answered' THEN reopened_count + 1 ELSE reopened_count END",
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

const INSERTED = (row: KnowledgeGapEntity) => ({ execute: { raw: [row] } })
const NOTHING = { execute: { raw: [] } }

const BUMP_SET = {
    count: NOW,
    lastSeenAt: NOW,
    topic: NOW,
    attributeGuess: NOW,
    exampleConversationId: NOW,
    status: NOW,
    answeredAt: NOW,
    answeredBy: NOW,
    reopenedCount: NOW,
}

const BUMP_WHERE = ["workspace_id = :workspaceId AND id = :id", { workspaceId: WS, id: "g1" }]

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
        it("ignores a question with no letter or digit before querying", async () => {
            const em = mockEntityManager()
            const service = await build(em)

            await expect(service.record(WS, inputOf({ question: " ?! -- " }))).resolves.toBeNull()

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
                        keywords: [],
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
                        keywords: [],
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
            expect(evaluatedValues(bump?.callsOf("set")[0]?.[0])).toEqual(BUMP_SQL)
            expect(bump?.callsOf("where")).toEqual([BUMP_WHERE])
            expect(bump?.callsOf("setParameters")).toEqual([
                [{ subject: "Tea", attribute: "Price", conversationId: "c1" }],
            ])
            expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
        })
    })
})

describe("KnowledgeGapsService", () => {
    describe("record: the same gap by the model's topic", () => {
        it("counts again a differently worded question the model gave the same topic and attribute", async () => {
            const em = mockEntityManager({
                find: [
                    KnowledgeGapEntity,
                    [
                        Object.assign(rowOf(), {
                            id: "other-attribute",
                            questionKey: "brake-pads-stock",
                            topic: "Brake pads",
                            attributeGuess: "Stock",
                        }),
                        Object.assign(rowOf(), {
                            questionKey: "do-you-fit-brake-pads",
                            topic: "Brake pads",
                            attributeGuess: "Fitting price",
                        }),
                    ],
                ],
            })
            const [bump] = queueQueryBuilders(em, [NOTHING])
            const service = await build(em)

            await expect(
                service.record(
                    WS,
                    inputOf({ question: "How much to fit new pads?", topic: " brake PADS | Fitting price " }),
                ),
            ).resolves.toEqual({
                gap: { ...gap, topic: "Brake pads", attributeGuess: "Fitting price" },
                isNew: false,
                reopened: false,
            })

            expect(bump?.callsOf("where")).toEqual([BUMP_WHERE])
            expect(bump?.callsOf("setParameters")).toEqual([
                [{ subject: "brake PADS", attribute: "Fitting price", conversationId: null }],
            ])
        })

        it("no word compare: a similar question with no topic is a NEW gap, as is one whose stored gap had no topic", async () => {
            const stored = [
                Object.assign(rowOf(), {
                    id: "pads",
                    questionKey: "price-to-fit-brake-pads",
                    topic: "Brake pads",
                    attributeGuess: "Fitting price",
                }),
                Object.assign(rowOf(), {
                    id: "untopical",
                    questionKey: "chain-wax-price",
                    topic: null,
                    attributeGuess: null,
                }),
            ]
            const em = mockEntityManager({ find: [KnowledgeGapEntity, stored] })
            const [first, second] = queueQueryBuilders(em, [INSERTED(rowOf()), INSERTED(rowOf())])
            const service = await build(em)

            await service.record(WS, inputOf({ question: "Price to fit the brake pads?" }))
            await service.record(WS, inputOf({ question: "What does chain wax cost?", topic: "Chain wax | Price" }))

            expect(first?.callsOf("insert")).toEqual([[]])
            expect(first?.callsOf("values")[0]?.[0]).toMatchObject({
                questionKey: "price-to-fit-the-brake-pads",
                topic: null,
                keywords: [],
            })
            expect(second?.callsOf("insert")).toEqual([[]])
            expect(second?.callsOf("values")[0]?.[0]).toMatchObject({ topic: "Chain wax", attributeGuess: "Price" })
        })
    })
})

describe("KnowledgeGapsService", () => {
    describe("record: the same gap by the question text", () => {
        it("the same question text counts again even without a topic", async () => {
            const em = mockEntityManager({
                find: [
                    KnowledgeGapEntity,
                    [
                        Object.assign(rowOf(), {
                            questionKey: "price-to-fit-brake-pads",
                            topic: null,
                            attributeGuess: null,
                        }),
                    ],
                ],
            })
            const [bump] = queueQueryBuilders(em, [INSERTED(Object.assign(rowOf(), { count: 2 }))])
            const service = await build(em)

            await expect(service.record(WS, inputOf({ question: "Price to fit brake pads?" }))).resolves.toMatchObject({
                isNew: false,
                gap: { count: 2 },
            })
            expect(bump?.callsOf("update")).toEqual([[]])
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

    it("writes now() for the times a dismissal or an answer stamps", async () => {
        const em = mockEntityManager({ update: [KnowledgeGapEntity, {}] })
        const service = await build(em)

        await service.dismiss(WS, "g1", "u1")
        await service.answer(WS, "g2", "owner")

        expect(em.update.mock.calls.map(([, , changes]) => evaluatedValues(changes))).toEqual([
            { status: "dismissed", dismissedAt: "now()", dismissedBy: "u1" },
            { status: "answered", answeredAt: "now()", answeredBy: "owner" },
        ])
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
                plain({ status: "dismissed", dismissedAt: NOW, dismissedBy: "u1" }),
            ],
            [
                KnowledgeGapEntity,
                plain({ workspaceId: WS, id: "g2", status: "open" }),
                plain({ status: "answered", answeredAt: NOW, answeredBy: "owner" }),
            ],
        ])
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
