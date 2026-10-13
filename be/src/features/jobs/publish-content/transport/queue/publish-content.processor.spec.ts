import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { ClaimedJob } from "@modules/platform/jobs"
import { RunAutomationsStep } from "../../steps/run-automations.step"
import { PublishContentProcessor } from "./publish-content.processor"

const jobOf = builder<ClaimedJob>({
    jobId: "content-job-1",
    kind: "content_tick",
    fencingToken: 7,
    currentStep: "run",
    payload: { workspaceId: "workspace-1", force: true },
})

const build = async () => {
    const automations = mock<RunAutomationsStep>()
    automations.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [PublishContentProcessor, { provide: RunAutomationsStep, useValue: automations }],
    }).compile()
    return { processor: moduleRef.get(PublishContentProcessor), automations }
}

describe("PublishContentProcessor", () => {
    it("consumes the content tick queue with the default job and concurrency", async () => {
        const { processor } = await build()

        expect([processor.queue, processor.job, processor.concurrency]).toEqual(["content_tick", undefined, undefined])
    })

    it("passes the complete fenced claim to the step and awaits its completion", async () => {
        const { processor, automations } = await build()
        const job = jobOf()
        let release: () => void = () => undefined
        const pending = new Promise<void>((resolve) => {
            release = resolve
        })
        automations.run.mockReturnValue(pending)
        let finished = false

        const processing = processor.process(job).then(() => {
            finished = true
        })
        await Promise.resolve()

        expect(automations.run.mock.calls).toEqual([[job]])
        expect(automations.run.mock.calls[0]?.[0]).toBe(job)
        expect(finished).toBe(false)
        release()
        await expect(processing).resolves.toBeUndefined()
        expect(finished).toBe(true)
        expect(automations.run.mock.calls).toEqual([[job]])
    })

    it("propagates the stale-token refusal from the step unchanged", async () => {
        const { processor, automations } = await build()
        const job = jobOf()
        const refusal = new Error("JOBS_FENCED_OUT")
        automations.run.mockRejectedValue(refusal)

        await expect(processor.process(job)).rejects.toBe(refusal)

        expect(automations.run.mock.calls).toEqual([[job]])
    })

    it("propagates an automation failure so the queue can retry the delivery", async () => {
        const { processor, automations } = await build()
        const job = jobOf()
        const failure = new Error("content tick unavailable")
        automations.run.mockRejectedValue(failure)

        await expect(processor.process(job)).rejects.toBe(failure)

        expect(automations.run.mock.calls).toEqual([[job]])
    })
})
