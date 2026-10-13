import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { LEAD_ACTIONS_QUEUE, RUN_LEAD_ACTION_JOB } from "./lead-actions.contracts"
import { LeadActionsQueue } from "./lead-actions.queue"

const payload = { workspaceId: "ws-1", runId: "run-1" }

const build = async () => {
    const outbox = mock<QueueOutbox>({ write: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [LeadActionsQueue, { provide: QUEUE_OUTBOX, useValue: outbox }],
    }).compile()
    return { queue: moduleRef.get(LeadActionsQueue), outbox }
}

describe("LeadActionsQueue", () => {
    it("writes one delivery keyed on the run", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()

        await queue.enqueue(payload, tx)

        expect(outbox.write).toHaveBeenCalledWith(tx, LEAD_ACTIONS_QUEUE, payload, {
            job: RUN_LEAD_ACTION_JOB,
            dedupeKey: "lead-actions.run:run-1",
        })
    })
})
