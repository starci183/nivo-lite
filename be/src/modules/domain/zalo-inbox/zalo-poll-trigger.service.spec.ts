import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { ZaloInboxPollService } from "./zalo-poll.service"
import { ZaloInboxPollTriggerService } from "./zalo-poll-trigger.service"

const ready = {
    workspaceId: "ws-1",
    connectionId: "conn-1",
    provider: "zalo_oa",
    dedupeKey: "conn-1:zalo_token:abc",
}

const build = async (polls: boolean) => {
    const tx = fakeTransaction(mockEntityManager())
    const outbox = recordingQueueOutbox()
    const write = jest.spyOn(outbox, "write")
    const poll = mock<ZaloInboxPollService>()
    poll.polls.mockReturnValue(polls)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloInboxPollTriggerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: ZaloInboxPollService, useValue: poll },
        ],
    }).compile()
    return { trigger: moduleRef.get(ZaloInboxPollTriggerService), tx, outbox, write, poll }
}

describe("ZaloInboxPollTriggerService enqueueFirstPoll", () => {
    it("enqueues the one-connection reconcile job once per fact", async () => {
        const { trigger, tx, outbox, write, poll } = await build(true)

        await expect(trigger.enqueueFirstPoll(ready)).resolves.toBe(true)

        expect(poll.polls).toHaveBeenCalledWith("zalo_oa")
        expect(write).toHaveBeenCalledWith(
            expect.anything(),
            "zalo-inbox-poll",
            { connectionId: "conn-1", workspaceId: "ws-1" },
            { job: "reconcile-zalo-inbox", dedupeKey: "zalo-inbox-poll:ready:conn-1:zalo_token:abc" },
        )
        expect(outbox.allInTransaction).toBe(true)
        expect(tx.commits).toBe(1)
    })

    it("ignores a connection of a provider that cannot be read back", async () => {
        const { trigger, outbox, write } = await build(false)

        await expect(trigger.enqueueFirstPoll({ ...ready, provider: "telegram" })).resolves.toBe(false)

        expect(write).not.toHaveBeenCalled()
        expect(outbox.jobs).toEqual([])
    })
})
