import { mock } from "@starci/jest-preset"
import type { N8nRunsService } from "@modules/domain/n8n-runs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { EmitN8nEventStep } from "./deliver.step"

const JOB: ClaimedJob = {
    jobId: "job-emit-1",
    kind: "n8n.emit",
    fencingToken: 7,
    currentStep: null,
    payload: {
        workspaceId: "workspace-1",
        runId: "run-1",
        event: "pipeline.email-daily-report",
        urls: ["https://example.com/webhook"],
        paths: ["email-daily-report"],
        data: { report: "daily" },
    },
}

const build = () => {
    const runs = mock<N8nRunsService>()
    const claims = mock<JobClaims>()
    const step = new EmitN8nEventStep(runs, claims)
    return { step, runs, claims }
}

describe("EmitN8nEventStep", () => {
    it("awaits the guarded advance before delivering the claimed payload", async () => {
        const { step, runs, claims } = build()
        claims.advance.mockImplementation(async () => {
            await Promise.resolve()
            expect(runs.deliver).not.toHaveBeenCalled()
        })
        runs.deliver.mockResolvedValue()

        await expect(step.run(JOB)).resolves.toBeUndefined()

        expect(claims.advance).toHaveBeenCalledTimes(1)
        expect(claims.advance).toHaveBeenCalledWith({
            jobId: "job-emit-1",
            expectedFencingToken: 7,
            step: "deliver",
        })
        expect(runs.deliver).toHaveBeenCalledTimes(1)
        expect(runs.deliver).toHaveBeenCalledWith(JOB.payload)
    })

    it("does not deliver when the guarded advance rejects a stale claim", async () => {
        const { step, runs, claims } = build()
        const failure = new Error("stale fencing token")
        claims.advance.mockRejectedValue(failure)

        await expect(step.run(JOB)).rejects.toBe(failure)

        expect(claims.advance).toHaveBeenCalledTimes(1)
        expect(runs.deliver).not.toHaveBeenCalled()
    })

    it("propagates a delivery failure after recording the step", async () => {
        const { step, runs, claims } = build()
        const failure = new Error("delivery unavailable")
        claims.advance.mockResolvedValue()
        runs.deliver.mockRejectedValue(failure)

        await expect(step.run(JOB)).rejects.toBe(failure)

        expect(claims.advance).toHaveBeenCalledTimes(1)
        expect(runs.deliver).toHaveBeenCalledTimes(1)
        expect(runs.deliver).toHaveBeenCalledWith(JOB.payload)
    })
})
