import { mock } from "@starci/jest-preset"
import type { AutomationEngineService } from "@modules/domain/automations"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { RunAutomationTickStep } from "./tick.step"

const JOB: ClaimedJob = {
    jobId: "job-tick-1",
    kind: "automation.tick",
    fencingToken: 11,
    currentStep: null,
    payload: {},
}

const build = () => {
    const engine = mock<AutomationEngineService>()
    const claims = mock<JobClaims>()
    const step = new RunAutomationTickStep(engine, claims)
    return { step, engine, claims }
}

describe("RunAutomationTickStep", () => {
    it("awaits the guarded advance before starting the engine tick", async () => {
        const { step, engine, claims } = build()
        claims.advance.mockImplementation(async () => {
            await Promise.resolve()
            expect(engine.tickNow).not.toHaveBeenCalled()
        })
        engine.tickNow.mockResolvedValue({ pipelines: 2, runs: 3 })

        await expect(step.run(JOB)).resolves.toBeUndefined()

        expect(claims.advance).toHaveBeenCalledTimes(1)
        expect(claims.advance).toHaveBeenCalledWith({
            jobId: "job-tick-1",
            expectedFencingToken: 11,
            step: "tick",
        })
        expect(engine.tickNow).toHaveBeenCalledTimes(1)
        expect(engine.tickNow).toHaveBeenCalledWith()
    })

    it("does not start the engine when the guarded advance rejects a stale claim", async () => {
        const { step, engine, claims } = build()
        const failure = new Error("stale fencing token")
        claims.advance.mockRejectedValue(failure)

        await expect(step.run(JOB)).rejects.toBe(failure)

        expect(claims.advance).toHaveBeenCalledTimes(1)
        expect(engine.tickNow).not.toHaveBeenCalled()
    })

    it("propagates an engine failure after recording the step", async () => {
        const { step, engine, claims } = build()
        const failure = new Error("tick unavailable")
        claims.advance.mockResolvedValue()
        engine.tickNow.mockRejectedValue(failure)

        await expect(step.run(JOB)).rejects.toBe(failure)

        expect(claims.advance).toHaveBeenCalledTimes(1)
        expect(engine.tickNow).toHaveBeenCalledTimes(1)
        expect(engine.tickNow).toHaveBeenCalledWith()
    })
})
