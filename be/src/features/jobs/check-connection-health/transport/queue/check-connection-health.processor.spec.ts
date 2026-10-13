import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { ClaimedJob } from "@modules/platform/jobs"
import { JudgeConnectionsStep } from "../../steps/judge-connections.step"
import { CheckConnectionHealthProcessor } from "./check-connection-health.processor"

const job: ClaimedJob = {
    jobId: "job-1",
    kind: "connection_health",
    fencingToken: 7,
    currentStep: null,
    payload: { silentAfterHours: 72 },
}

const build = async () => {
    const judge = mock<JudgeConnectionsStep>()
    judge.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [CheckConnectionHealthProcessor, { provide: JudgeConnectionsStep, useValue: judge }],
    }).compile()
    return { processor: moduleRef.get(CheckConnectionHealthProcessor), judge }
}

describe("CheckConnectionHealthProcessor", () => {
    it("consumes the connection-health queue", async () => {
        const { processor } = await build()

        expect(processor.queue).toBe("connection_health")
    })

    it("passes the fenced claim to the judge step exactly once and awaits its completion", async () => {
        const { processor, judge } = await build()
        let finishStep = () => {}
        const pending = new Promise<void>((resolve) => {
            finishStep = resolve
        })
        judge.run.mockReturnValue(pending)
        const finished = jest.fn()

        const processing = processor.process(job).then(finished)
        await Promise.resolve()

        expect(judge.run.mock.calls).toEqual([[job]])
        expect(judge.run.mock.calls[0]?.[0]).toBe(job)
        expect(finished).not.toHaveBeenCalled()

        finishStep()

        await expect(processing).resolves.toBeUndefined()
        expect(finished.mock.calls).toEqual([[undefined]])
        expect(judge.run.mock.calls).toEqual([[job]])
    })

    it("propagates the judge step failure unchanged", async () => {
        const { processor, judge } = await build()
        const failure = new Error("claim was fenced out")
        judge.run.mockRejectedValue(failure)

        await expect(processor.process(job)).rejects.toBe(failure)
        expect(judge.run.mock.calls).toEqual([[job]])
    })
})
