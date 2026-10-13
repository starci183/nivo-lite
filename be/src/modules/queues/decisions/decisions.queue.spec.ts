import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { DECISIONS_QUEUE, DecisionsJob } from "./decisions.contracts"
import type {
    ConfirmCommandPayload,
    DecideExecutionPayload,
    DecideWorkPayload,
    ProposeCommandPayload,
} from "./decisions.contracts"
import { DecisionsQueue } from "./decisions.queue"

const build = async () => {
    const outbox = mock<QueueOutbox>()
    outbox.write.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [DecisionsQueue, { provide: QUEUE_OUTBOX, useValue: outbox }],
    }).compile()
    return { queue: moduleRef.get(DecisionsQueue), outbox }
}

describe("DecisionsQueue", () => {
    it("writes a work decision with its job and a dedupe key on the work item", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()
        const payload: DecideWorkPayload = {
            userId: "user-1",
            workspaceId: "workspace-1",
            locale: "vi",
            workItemId: "work-1",
            decision: "approved",
            edits: { draft: "Updated draft", amount_vnd: 150_000 },
            note: "Approved",
            basis: "Verified payment",
        }

        await expect(queue.enqueueDecideWork(payload, tx)).resolves.toBeUndefined()

        expect(outbox.write).toHaveBeenCalledTimes(1)
        expect(outbox.write).toHaveBeenCalledWith(tx, DECISIONS_QUEUE, payload, {
            job: DecisionsJob.DecideWork,
            dedupeKey: "decisions.decide-work:work-1",
        })
    })

    it("writes an execution decision with its job and a dedupe key on the approval card", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()
        const payload: DecideExecutionPayload = {
            userId: "user-2",
            workspaceId: "workspace-2",
            locale: "en",
            executionId: "execution-2",
            decision: "rejected",
            editedDraft: null,
        }

        await expect(queue.enqueueDecideExecution(payload, tx)).resolves.toBeUndefined()

        expect(outbox.write).toHaveBeenCalledTimes(1)
        expect(outbox.write).toHaveBeenCalledWith(tx, DECISIONS_QUEUE, payload, {
            job: DecisionsJob.DecideExecution,
            dedupeKey: "decisions.decide-execution:execution-2",
        })
    })

    it("writes a command proposal with its job and a dedupe key on the Office message", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()
        const payload: ProposeCommandPayload = {
            userId: "user-3",
            workspaceId: "workspace-3",
            locale: "vi",
            messageId: "message-3",
        }

        await expect(queue.enqueueProposeCommand(payload, tx)).resolves.toBeUndefined()

        expect(outbox.write).toHaveBeenCalledTimes(1)
        expect(outbox.write).toHaveBeenCalledWith(tx, DECISIONS_QUEUE, payload, {
            job: DecisionsJob.ProposeCommand,
            dedupeKey: "office.propose-command:message-3",
        })
    })

    it("writes a command confirmation with its job and a dedupe key on the candidate", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()
        const payload: ConfirmCommandPayload = {
            userId: "user-4",
            workspaceId: "workspace-4",
            locale: "en",
            candidateId: "candidate-4",
        }

        await expect(queue.enqueueConfirmCommand(payload, tx)).resolves.toBeUndefined()

        expect(outbox.write).toHaveBeenCalledTimes(1)
        expect(outbox.write).toHaveBeenCalledWith(tx, DECISIONS_QUEUE, payload, {
            job: DecisionsJob.ConfirmCommand,
            dedupeKey: "office.confirm-command:candidate-4",
        })
    })
})
