import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { FirstPollEnqueueService } from "./first-poll-enqueue.service"
import { PollScheduleService } from "./poll-schedule.service"

const target = {
    queue: "some-poll",
    job: "reconcile-some",
    ready: { workspaceId: "ws-1", connectionId: "conn-1", dedupeKey: "conn-1:token:abc" },
}

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const outbox = recordingQueueOutbox()
    const write = jest.spyOn(outbox, "write")
    const schedule = mock<PollScheduleService>()
    schedule.markReady.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            FirstPollEnqueueService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: PollScheduleService, useValue: schedule },
        ],
    }).compile()
    return { service: moduleRef.get(FirstPollEnqueueService), tx, outbox, write, schedule }
}

describe("FirstPollEnqueueService enqueue", () => {
    it("writes the one-connection job in a transaction, keyed by the delivery, and makes the connection hot", async () => {
        const { service, tx, outbox, write, schedule } = await build()

        await service.enqueue(target)

        expect(write).toHaveBeenCalledWith(
            expect.anything(),
            "some-poll",
            { connectionId: "conn-1", workspaceId: "ws-1" },
            { job: "reconcile-some", dedupeKey: "some-poll:ready:conn-1:token:abc" },
        )
        expect(outbox.allInTransaction).toBe(true)
        expect(schedule.markReady).toHaveBeenCalledWith("conn-1")
        expect(tx.commits).toBe(1)
    })
})
