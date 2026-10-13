import { mock } from "@starci/jest-preset"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { RunAutomationTickStep } from "../../steps/tick.step"
import { RunAutomationTickProcessor } from "./run-automation-tick.processor"

const JOB: ClaimedJob = {
    jobId: "job-tick-1",
    kind: "automation.tick",
    fencingToken: 11,
    currentStep: "tick",
    payload: {},
}

describe("RunAutomationTickProcessor", () => {
    it("declares the automation tick queue and job and runs the claimed job", async () => {
        const step = mock<RunAutomationTickStep>()
        step.run.mockResolvedValue()
        const processor = new RunAutomationTickProcessor(step)

        await expect(processor.process(JOB)).resolves.toBeUndefined()

        expect(processor.queue).toBe("automation")
        expect(processor.job).toBe("automation.tick")
        expect(step.run).toHaveBeenCalledTimes(1)
        expect(step.run).toHaveBeenCalledWith(JOB)
    })

    it("propagates the step failure for the runner to settle", async () => {
        const step = mock<RunAutomationTickStep>()
        const failure = new Error("stale fencing token")
        step.run.mockRejectedValue(failure)
        const processor = new RunAutomationTickProcessor(step)

        await expect(processor.process(JOB)).rejects.toBe(failure)

        expect(step.run).toHaveBeenCalledTimes(1)
        expect(step.run).toHaveBeenCalledWith(JOB)
    })
})
