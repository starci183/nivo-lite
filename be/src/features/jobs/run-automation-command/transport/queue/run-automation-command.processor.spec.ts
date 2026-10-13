import { mock } from "@starci/jest-preset"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { RunCommandStep } from "../../steps/run-command.step"
import { RunAutomationCommandProcessor } from "./run-automation-command.processor"

const JOB: ClaimedJob = {
    jobId: "job-command-1",
    kind: "automation.command",
    fencingToken: 11,
    currentStep: "command",
    payload: { commandId: "00000000-0000-4000-8000-000000000001" },
}

describe("RunAutomationCommandProcessor", () => {
    it("declares the automation command queue and job and runs the claimed job", async () => {
        const step = mock<RunCommandStep>()
        step.run.mockResolvedValue()
        const processor = new RunAutomationCommandProcessor(step)

        await expect(processor.process(JOB)).resolves.toBeUndefined()

        expect(processor.queue).toBe("automation")
        expect(processor.job).toBe("automation.command")
        expect(step.run).toHaveBeenCalledTimes(1)
        expect(step.run).toHaveBeenCalledWith(JOB)
    })

    it("propagates the step failure for the runner to settle", async () => {
        const step = mock<RunCommandStep>()
        const failure = new Error("stale fencing token")
        step.run.mockRejectedValue(failure)
        const processor = new RunAutomationCommandProcessor(step)

        await expect(processor.process(JOB)).rejects.toBe(failure)

        expect(step.run).toHaveBeenCalledTimes(1)
        expect(step.run).toHaveBeenCalledWith(JOB)
    })
})
