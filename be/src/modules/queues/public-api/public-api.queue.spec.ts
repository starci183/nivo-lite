import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { PublicApiQueueJob } from "./public-api.contracts"
import { PUBLIC_API_QUEUE, PublicApiQueue } from "./public-api.queue"

const payload = { requestId: "req-1", workspaceId: "ws-1" }

const build = async () => {
    const outbox = mock<QueueOutbox>({ write: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [PublicApiQueue, { provide: QUEUE_OUTBOX, useValue: outbox }],
    }).compile()
    return { queue: moduleRef.get(PublicApiQueue), outbox }
}

describe("PublicApiQueue", () => {
    it("writes the follow-up keyed on the ledger row", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()

        await queue.enqueueRequest(payload, tx)

        expect(outbox.write).toHaveBeenCalledWith(tx, PUBLIC_API_QUEUE, payload, {
            job: PublicApiQueueJob.Request,
            dedupeKey: "public-api.request:req-1",
        })
    })
})
