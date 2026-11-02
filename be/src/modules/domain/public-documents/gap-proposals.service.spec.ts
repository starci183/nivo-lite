import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import type { GapRecord } from "@modules/domain/knowledge-gaps"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { KnowledgeQueue } from "@modules/queues/knowledge"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { KNOWLEDGE_QUEUE_PRODUCER } from "@modules/queues/knowledge"
import { GapProposalsService } from "./gap-proposals.service"
import { PublicDocumentEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"
const gap: GapRecord = {
    id: "g1",
    module: "chatbot",
    question: "Cua hang co giao trong toi nay khong?",
    topic: null,
    attributeGuess: null,
    count: 1,
    firstSeenAt: "2026-11-01T00:00:00.000Z",
    lastSeenAt: "2026-11-01T00:00:00.000Z",
    exampleConversationId: "c1",
    status: "open",
    reopenedCount: 0,
}

const build = async (em: MockEntityManager) => {
    const queue = mock<KnowledgeQueue>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            GapProposalsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: KNOWLEDGE_QUEUE_PRODUCER, useValue: queue },
        ],
    }).compile()
    return { proposals: moduleRef.get(GapProposalsService), queue }
}

describe("GapProposalsService open", () => {
    it("writes a drafting proposal for the question and queues the look in one transaction", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                exists: [PublicDocumentEntity, false],
            }),
        )
        const { proposals, queue } = await build(tx.em)
        const [insert] = queueQueryBuilders(tx.em, [{ execute: { identifiers: [{ id: "d1" }] } }])

        await proposals.open(WS, gap)

        expect(tx.em.createQueryBuilder).toHaveBeenCalledWith(PublicDocumentEntity, "document")
        expect(insert?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: WS,
                    title: gap.question,
                    kind: "answer",
                    status: "drafting",
                    question: gap.question,
                    gapId: "g1",
                },
            ],
        ])
        expect(insert?.callsOf("orIgnore")).toEqual([[]])
        expect(queue.enqueuePublicDraft).toHaveBeenCalledWith(
            { documentId: "d1", workspaceId: WS, draftRevision: 0 },
            expect.anything(),
        )
        expect(tx.commits).toBe(1)
    })

    it("looks nothing up again for a question that already has a proposal", async () => {
        const em = mockEntityManager({ exists: [PublicDocumentEntity, true] })
        const { proposals, queue } = await build(em)

        await proposals.open(WS, gap)

        expect(em.insert).not.toHaveBeenCalled()
        expect(queue.enqueuePublicDraft).not.toHaveBeenCalled()
    })

    it("queues nothing when the insert answers no row", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                exists: [PublicDocumentEntity, false],
            }),
        )
        const { proposals, queue } = await build(tx.em)
        queueQueryBuilders(tx.em, [{ execute: { identifiers: [] } }])

        await proposals.open(WS, gap)

        expect(queue.enqueuePublicDraft).not.toHaveBeenCalled()
    })
})
