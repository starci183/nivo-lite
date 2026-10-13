import { mock } from "@starci/jest-preset"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { EmitN8nEventStep } from "../../steps/deliver.step"
import { EmitN8nEventProcessor } from "./emit-n8n-event.processor"

const JOB: ClaimedJob = {
    jobId: "job-emit-1",
    kind: "n8n.emit",
    fencingToken: 7,
    currentStep: "deliver",
    payload: { runId: "run-1" },
}

describe("EmitN8nEventProcessor", () => {
    it("declares the n8n delivery queue and job and runs the claimed job", async () => {
        const step = mock<EmitN8nEventStep>()
        step.run.mockResolvedValue()
        const processor = new EmitN8nEventProcessor(step)

        await expect(processor.process(JOB)).resolves.toBeUndefined()

        expect(processor.queue).toBe("n8n")
        expect(processor.job).toBe("n8n.emit")
        expect(step.run).toHaveBeenCalledTimes(1)
        expect(step.run).toHaveBeenCalledWith(JOB)
    })

    it("propagates the step failure for the runner to settle", async () => {
        const step = mock<EmitN8nEventStep>()
        const failure = new Error("stale fencing token")
        step.run.mockRejectedValue(failure)
        const processor = new EmitN8nEventProcessor(step)

        await expect(processor.process(JOB)).rejects.toBe(failure)

        expect(step.run).toHaveBeenCalledTimes(1)
        expect(step.run).toHaveBeenCalledWith(JOB)
    })
})
