import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { FirstPollEnqueueService } from "@modules/domain/connection-poll"
import { BankFeedPollService } from "./bank-feed-poll.service"
import { BankFeedPollTriggerService } from "./bank-feed-poll-trigger.service"

const ready = {
    workspaceId: "ws-1",
    connectionId: "conn-1",
    provider: "sepay",
    dedupeKey: "conn-1:api_token:abc",
}

const build = async (polls: boolean) => {
    const poll = mock<BankFeedPollService>()
    poll.polls.mockReturnValue(polls)
    const firstPolls = mock<FirstPollEnqueueService>()
    firstPolls.enqueue.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankFeedPollTriggerService,
            { provide: BankFeedPollService, useValue: poll },
            { provide: FirstPollEnqueueService, useValue: firstPolls },
        ],
    }).compile()
    return { trigger: moduleRef.get(BankFeedPollTriggerService), poll, firstPolls }
}

describe("BankFeedPollTriggerService enqueueFirstPoll", () => {
    it("enqueues the one-connection reconcile job on the bank feed queue", async () => {
        const { trigger, poll, firstPolls } = await build(true)

        await expect(trigger.enqueueFirstPoll(ready)).resolves.toBe(true)

        expect(poll.polls).toHaveBeenCalledWith("sepay")
        expect(firstPolls.enqueue).toHaveBeenCalledWith({
            queue: "bank-feed-poll",
            job: "reconcile-bank-feed",
            ready,
        })
    })

    it("ignores a connection of a provider that cannot be read back", async () => {
        const { trigger, firstPolls } = await build(false)

        await expect(trigger.enqueueFirstPoll({ ...ready, provider: "telegram" })).resolves.toBe(false)

        expect(firstPolls.enqueue).not.toHaveBeenCalled()
    })
})
