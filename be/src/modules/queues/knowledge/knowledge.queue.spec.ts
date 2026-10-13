import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { KnowledgeJob } from "./knowledge.contracts"
import { KNOWLEDGE_QUEUE, KnowledgeQueue } from "./knowledge.queue"

const source = { sourceId: "source-1", workspaceId: "ws-1" }
const reembed = { workspaceId: "ws-1", model: "embed-1" }

const build = async () => {
    const outbox = mock<QueueOutbox>({ write: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [KnowledgeQueue, { provide: QUEUE_OUTBOX, useValue: outbox }],
    }).compile()
    return { queue: moduleRef.get(KnowledgeQueue), outbox }
}

describe("KnowledgeQueue", () => {
    it("keys an index and a fact reading, and a retry or a later reading on its time", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()

        await queue.enqueueIndex(source, tx)
        await queue.enqueueIndex(source, tx, 20)
        await queue.enqueueFacts(source, tx)
        await queue.enqueueFacts(source, tx, 30)

        expect(outbox.write).toHaveBeenNthCalledWith(1, tx, KNOWLEDGE_QUEUE, source, {
            job: KnowledgeJob.Index,
            dedupeKey: "knowledge.index:source-1",
        })
        expect(outbox.write).toHaveBeenNthCalledWith(2, tx, KNOWLEDGE_QUEUE, source, {
            job: KnowledgeJob.Index,
            dedupeKey: "knowledge.index:source-1:retry:20",
        })
        expect(outbox.write).toHaveBeenNthCalledWith(3, tx, KNOWLEDGE_QUEUE, source, {
            job: KnowledgeJob.Facts,
            dedupeKey: "knowledge.facts:source-1",
        })
        expect(outbox.write).toHaveBeenNthCalledWith(4, tx, KNOWLEDGE_QUEUE, source, {
            job: KnowledgeJob.Facts,
            dedupeKey: "knowledge.facts:source-1:run:30",
        })
    })

    it("keys a re-embed on the model, and a continuation on the model and the time", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()

        await queue.enqueueReembed(reembed, tx)
        await queue.enqueueReembed({ workspaceId: "ws-1" }, tx)
        await queue.enqueueReembed(reembed, tx, 40)
        await queue.enqueueReembed({ workspaceId: "ws-1" }, tx, 50)

        expect(outbox.write).toHaveBeenNthCalledWith(1, tx, KNOWLEDGE_QUEUE, reembed, {
            job: KnowledgeJob.Reembed,
            dedupeKey: "knowledge.reembed:ws-1:embed-1",
        })
        expect(outbox.write).toHaveBeenNthCalledWith(
            2,
            tx,
            KNOWLEDGE_QUEUE,
            { workspaceId: "ws-1" },
            {
                job: KnowledgeJob.Reembed,
                dedupeKey: "knowledge.reembed:ws-1",
            },
        )
        expect(outbox.write).toHaveBeenNthCalledWith(3, tx, KNOWLEDGE_QUEUE, reembed, {
            job: KnowledgeJob.Reembed,
            dedupeKey: "knowledge.reembed:ws-1:embed-1:next:40",
        })
        expect(outbox.write).toHaveBeenNthCalledWith(
            4,
            tx,
            KNOWLEDGE_QUEUE,
            { workspaceId: "ws-1" },
            {
                job: KnowledgeJob.Reembed,
                dedupeKey: "knowledge.reembed:ws-1::next:50",
            },
        )
    })
})
