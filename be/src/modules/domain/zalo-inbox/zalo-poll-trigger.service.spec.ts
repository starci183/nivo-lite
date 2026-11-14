import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { FirstPollEnqueueService } from "@modules/domain/connection-poll"
import { ZaloInboxPollService } from "./zalo-poll.service"
import { ZaloInboxPollTriggerService } from "./zalo-poll-trigger.service"

const ready = {
    workspaceId: "ws-1",
    connectionId: "conn-1",
    provider: "zalo_oa",
    dedupeKey: "conn-1:zalo_token:abc",
}

const build = async (polls: boolean) => {
    const poll = mock<ZaloInboxPollService>()
    poll.polls.mockReturnValue(polls)
    const firstPolls = mock<FirstPollEnqueueService>()
    firstPolls.enqueue.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloInboxPollTriggerService,
            { provide: ZaloInboxPollService, useValue: poll },
            { provide: FirstPollEnqueueService, useValue: firstPolls },
        ],
    }).compile()
    return { trigger: moduleRef.get(ZaloInboxPollTriggerService), poll, firstPolls }
}

describe("ZaloInboxPollTriggerService enqueueFirstPoll", () => {
    it("enqueues the one-connection reconcile job on the Zalo inbox queue", async () => {
        const { trigger, poll, firstPolls } = await build(true)

        await expect(trigger.enqueueFirstPoll(ready)).resolves.toBe(true)

        expect(poll.polls).toHaveBeenCalledWith("zalo_oa")
        expect(firstPolls.enqueue).toHaveBeenCalledWith({
            queue: "zalo-inbox-poll",
            job: "reconcile-zalo-inbox",
            ready,
        })
    })

    it("ignores a connection of a provider that cannot be read back", async () => {
        const { trigger, firstPolls } = await build(false)

        await expect(trigger.enqueueFirstPoll({ ...ready, provider: "telegram" })).resolves.toBe(false)

        expect(firstPolls.enqueue).not.toHaveBeenCalled()
    })
})
