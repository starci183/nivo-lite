import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { IndexedSourcesService } from "./indexed-sources.service"

const SOURCE = { sourceId: "s1", workspaceId: "ws-1" }
const CLAIM = { consumer: "knowledge_source_indexed__brain", dedupeKey: "s1:1000" }

const build = async (claimWon = true) => {
    const tx = fakeTransaction(mockEntityManager())
    const inbox = mock<Inbox>({ claim: jest.fn().mockResolvedValue(claimWon) })
    const queue = mock<KnowledgeQueue>()
    queue.enqueueFacts.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            IndexedSourcesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: INBOX, useValue: inbox },
            { provide: KnowledgeQueue, useValue: queue },
        ],
    }).compile()
    return { service: moduleRef.get(IndexedSourcesService), tx, inbox, queue }
}

describe("IndexedSourcesService", () => {
    it("claims the delivery and queues the facts job of this indexing in one transaction", async () => {
        const { service, tx, inbox, queue } = await build()

        await service.queueFacts({ ...SOURCE, indexedAt: 1000 }, CLAIM)

        expect(inbox.claim).toHaveBeenCalledWith("knowledge_source_indexed__brain", "s1:1000", expect.anything())
        expect(queue.enqueueFacts).toHaveBeenCalledWith(SOURCE, expect.anything(), 1000)
        expect(tx.commits).toBe(1)
    })

    it("queues nothing for a redelivery of an indexing it already took", async () => {
        const { service, queue } = await build(false)

        await service.queueFacts({ ...SOURCE, indexedAt: 1000 }, CLAIM)

        expect(queue.enqueueFacts).not.toHaveBeenCalled()
    })

    it("leaves a failure to queue to the bus, which retries the delivery", async () => {
        const { service, queue } = await build()
        const cause = new Error("outbox down")
        queue.enqueueFacts.mockRejectedValue(cause)

        await expect(service.queueFacts({ ...SOURCE, indexedAt: 1000 }, CLAIM)).rejects.toBe(cause)
    })
})
