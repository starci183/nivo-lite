import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { PollScheduleService } from "@modules/domain/connection-poll"
import { BankFeedPollService } from "./bank-feed-poll.service"
import { BankFeedPollTriggerService } from "./bank-feed-poll-trigger.service"

const ready = {
    workspaceId: "ws-1",
    connectionId: "conn-1",
    provider: "sepay",
    dedupeKey: "conn-1:api_token:abc",
}

const build = async (polls: boolean) => {
    const tx = fakeTransaction(mockEntityManager())
    const outbox = recordingQueueOutbox()
    const write = jest.spyOn(outbox, "write")
    const poll = mock<BankFeedPollService>()
    poll.polls.mockReturnValue(polls)
    const schedule = mock<PollScheduleService>()
    schedule.markReady.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankFeedPollTriggerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: BankFeedPollService, useValue: poll },
            { provide: PollScheduleService, useValue: schedule },
        ],
    }).compile()
    return { trigger: moduleRef.get(BankFeedPollTriggerService), tx, outbox, write, poll, schedule }
}

describe("BankFeedPollTriggerService enqueueFirstPoll", () => {
    it("enqueues the one-connection reconcile job once per fact", async () => {
        const { trigger, tx, outbox, write, poll, schedule } = await build(true)

        await expect(trigger.enqueueFirstPoll(ready)).resolves.toBe(true)

        expect(poll.polls).toHaveBeenCalledWith("sepay")
        expect(write).toHaveBeenCalledWith(
            expect.anything(),
            "bank-feed-poll",
            { connectionId: "conn-1", workspaceId: "ws-1" },
            { job: "reconcile-bank-feed", dedupeKey: "bank-feed-poll:ready:conn-1:api_token:abc" },
        )
        expect(outbox.allInTransaction).toBe(true)
        expect(schedule.markReady).toHaveBeenCalledWith("conn-1")
        expect(tx.commits).toBe(1)
    })

    it("ignores a connection of a provider that cannot be read back", async () => {
        const { trigger, outbox, write, schedule } = await build(false)

        await expect(trigger.enqueueFirstPoll({ ...ready, provider: "telegram" })).resolves.toBe(false)

        expect(write).not.toHaveBeenCalled()
        expect(schedule.markReady).not.toHaveBeenCalled()
        expect(outbox.jobs).toEqual([])
    })
})
