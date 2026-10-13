import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionHealthService } from "@modules/domain/channels"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { JudgeConnectionsStep } from "./judge-connections.step"

const claimed = (payload: object = { silentAfterHours: 24 }): ClaimedJob => ({
    jobId: "health-job-1",
    kind: "connection_health",
    fencingToken: 9,
    currentStep: null,
    payload,
})

const build = async () => {
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    const health = mock<ConnectionHealthService>()
    health.checkAll.mockResolvedValue({ checked: 3, ok: 1, silent: 1, failing: 1, changed: 2 })
    const moduleRef = await Test.createTestingModule({
        providers: [JudgeConnectionsStep, { provide: ConnectionHealthService, useValue: health }],
    })
        .useMocker((token) =>
            typeof token === "symbol" && token.description === "platform.jobs.claims" ? claims : undefined,
        )
        .compile()
    return { step: moduleRef.get(JudgeConnectionsStep), claims, health }
}

describe("JudgeConnectionsStep", () => {
    it("waits for the judge write under the held fencing token before checking connections", async () => {
        const { step, claims, health } = await build()
        let release: () => void = () => undefined
        const advanced = new Promise<void>((resolve) => {
            release = resolve
        })
        claims.advance.mockReturnValue(advanced)

        const running = step.run(claimed())

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "health-job-1", expectedFencingToken: 9, step: "judge" }]])
        expect(health.checkAll).not.toHaveBeenCalled()
        release()
        await expect(running).resolves.toBeUndefined()
        expect(health.checkAll.mock.calls).toEqual([[24]])
    })

    it("passes a zero-hour threshold through to the health check", async () => {
        const { step, claims, health } = await build()

        await expect(step.run(claimed({ silentAfterHours: 0 }))).resolves.toBeUndefined()

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "health-job-1", expectedFencingToken: 9, step: "judge" }]])
        expect(health.checkAll.mock.calls).toEqual([[0]])
    })

    it.each([{}, { silentAfterHours: "24" }])(
        "uses the health service default for an invalid tick: %p",
        async (payload) => {
            const { step, claims, health } = await build()

            await expect(step.run(claimed(payload))).resolves.toBeUndefined()

            expect(claims.advance.mock.calls).toEqual([
                [{ jobId: "health-job-1", expectedFencingToken: 9, step: "judge" }],
            ])
            expect(health.checkAll.mock.calls).toEqual([[]])
        },
    )

    it("propagates a stale-token refusal before judging any connection", async () => {
        const { step, claims, health } = await build()
        const refusal = new Error("JOBS_FENCED_OUT")
        claims.advance.mockRejectedValue(refusal)

        await expect(step.run(claimed())).rejects.toBe(refusal)

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "health-job-1", expectedFencingToken: 9, step: "judge" }]])
        expect(health.checkAll).not.toHaveBeenCalled()
    })

    it("propagates a health-check failure after recording the fenced step", async () => {
        const { step, claims, health } = await build()
        const failure = new Error("connections unavailable")
        health.checkAll.mockRejectedValue(failure)

        await expect(step.run(claimed())).rejects.toBe(failure)

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "health-job-1", expectedFencingToken: 9, step: "judge" }]])
        expect(health.checkAll.mock.calls).toEqual([[24]])
    })
})
