import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { KnowledgeGapsService } from "./knowledge-gaps.service"
import { KnowledgeGapEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = new Date("2026-10-12T10:00:00.000Z")

const rowOf = builder<KnowledgeGapEntity>({
    id: "g1",
    workspaceId: WS,
    module: "chatbot",
    question: "Brake pads fitting price?",
    questionKey: "brake-pads-fitting-price",
    keywords: [],
    topic: "Brake pads",
    attributeGuess: "Fitting price",
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

const NOW: unknown = expect.any(Function)

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [KnowledgeGapsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(KnowledgeGapsService)
}

const OPEN_QUERY = [
    KnowledgeGapEntity,
    plain({
        select: { id: true, module: true, topic: true, attributeGuess: true },
        where: { workspaceId: WS, status: "open" },
        take: 300,
    }),
]

const ANSWERED = (id: string, by: string) => [
    KnowledgeGapEntity,
    plain({ workspaceId: WS, id, status: "open" }),
    plain({ status: "answered", answeredAt: NOW, answeredBy: by }),
]

/** Open gaps of a bicycle workshop, with the topic and attribute the reporting model wrote. */
const OPEN_GAPS = (): Array<KnowledgeGapEntity> => [
    Object.assign(rowOf(), { id: "g1", topic: "Brake pads", attributeGuess: "Fitting price" }),
    Object.assign(rowOf(), {
        id: "wrong-module",
        module: "sales",
        topic: "Brake pads",
        attributeGuess: "Fitting price",
    }),
    Object.assign(rowOf(), { id: "other-attribute", topic: "Brake pads", attributeGuess: "Stock" }),
    Object.assign(rowOf(), {
        id: "no-topic",
        question: "Brake pads fitting price?",
        topic: null,
        attributeGuess: null,
    }),
    Object.assign(rowOf(), { id: "g2", topic: "brake  PADS", attributeGuess: "fitting-price" }),
]

describe("KnowledgeGapsService", () => {
    it("answers the open gaps of one module whose model topic and attribute are the truth's exact keys", async () => {
        const em = mockEntityManager({ find: [KnowledgeGapEntity, OPEN_GAPS()], update: [KnowledgeGapEntity, {}] })
        const service = await build(em)

        await expect(
            service.resolve(WS, {
                subject: "Brake pads",
                attribute: "Fitting price",
                module: "chatbot",
                by: "fact:f1",
            }),
        ).resolves.toBe(2)

        expect(em.find.mock.calls).toEqual([OPEN_QUERY])
        // Another attribute and a gap with no topic stay open, even when the gap's question has the truth's words.
        expect(em.update.mock.calls).toEqual([ANSWERED("g1", "fact:f1"), ANSWERED("g2", "fact:f1")])
    })

    it("resolves across every module; another attribute answers nothing", async () => {
        const em = mockEntityManager({ find: [KnowledgeGapEntity, OPEN_GAPS()], update: [KnowledgeGapEntity, {}] })
        const service = await build(em)

        await expect(
            service.resolve(WS, { subject: "Brake pads", attribute: "Fitting price", module: null, by: "document:d1" }),
        ).resolves.toBe(3)
        await expect(
            service.resolve(WS, { subject: "Brake pads", attribute: "Colour", module: null, by: "document:d2" }),
        ).resolves.toBe(0)

        expect(em.find.mock.calls).toEqual([OPEN_QUERY, OPEN_QUERY])
        expect(em.update.mock.calls).toEqual([
            ANSWERED("g1", "document:d1"),
            ANSWERED("wrong-module", "document:d1"),
            ANSWERED("g2", "document:d1"),
        ])
    })

    it("an answerer whose subject or attribute has no letter or digit answers nothing and reads nothing", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(
            service.resolve(WS, { subject: " -- ", attribute: "Fitting price", module: null, by: "owner" }),
        ).resolves.toBe(0)
        await expect(
            service.resolve(WS, { subject: "Brake pads", attribute: "?", module: null, by: "owner" }),
        ).resolves.toBe(0)

        expect(em.find).not.toHaveBeenCalled()
        expect(em.update).not.toHaveBeenCalled()
    })
})
