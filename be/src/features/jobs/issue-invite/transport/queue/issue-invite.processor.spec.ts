import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { IssueInviteStep } from "../../steps/issue-invite.step"
import { IssueInviteProcessor } from "./issue-invite.processor"

const claimedJob: ClaimedJob = {
    jobId: "job-1",
    kind: "invite_command",
    fencingToken: 7,
    currentStep: "issue",
    payload: { commandId: "command-1" },
}

const delivery: QueueDelivery = {
    id: "delivery-1",
    queue: "invite_command",
    job: "invite_command",
    payload: { commandId: "command-1" },
    attempt: 4,
    signal: new AbortController().signal,
}

const build = async () => {
    const issue = mock<IssueInviteStep>()
    issue.run.mockResolvedValue(undefined)
    issue.abandon.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [IssueInviteProcessor, { provide: IssueInviteStep, useValue: issue }],
    }).compile()
    return { processor: moduleRef.get(IssueInviteProcessor), issue }
}

describe("IssueInviteProcessor", () => {
    it("consumes the invitation command queue with the default job and concurrency", async () => {
        const { processor } = await build()

        expect([processor.queue, processor.job, processor.concurrency]).toEqual([
            "invite_command",
            undefined,
            undefined,
        ])
    })

    it("delegates the complete fenced claim to the step", async () => {
        const { processor, issue } = await build()

        await expect(processor.process(claimedJob)).resolves.toBeUndefined()

        expect(issue.run.mock.calls).toEqual([[claimedJob]])
        expect(issue.run.mock.calls[0]?.[0]).toBe(claimedJob)
        expect(issue.abandon).not.toHaveBeenCalled()
    })

    it("awaits and rethrows the step failure", async () => {
        const { processor, issue } = await build()
        const failure = new Error("claim fenced out")
        issue.run.mockRejectedValue(failure)

        await expect(processor.process(claimedJob)).rejects.toBe(failure)

        expect(issue.run.mock.calls).toEqual([[claimedJob]])
        expect(issue.abandon).not.toHaveBeenCalled()
    })

    it("abandons exactly the delivery payload when the job ends as failed", async () => {
        const { processor, issue } = await build()

        await expect(processor.onFailed(delivery)).resolves.toBeUndefined()

        expect(issue.abandon.mock.calls).toEqual([[delivery.payload]])
        expect(issue.abandon.mock.calls[0]?.[0]).toBe(delivery.payload)
        expect(issue.run).not.toHaveBeenCalled()
    })

    it("awaits and rethrows the abandonment failure", async () => {
        const { processor, issue } = await build()
        const failure = new Error("command settlement unavailable")
        issue.abandon.mockRejectedValue(failure)

        await expect(processor.onFailed(delivery)).rejects.toBe(failure)

        expect(issue.abandon.mock.calls).toEqual([[delivery.payload]])
        expect(issue.run).not.toHaveBeenCalled()
    })
})
