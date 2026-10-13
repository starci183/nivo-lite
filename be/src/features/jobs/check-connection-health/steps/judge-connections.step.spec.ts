import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionHealthService } from "@modules/domain/channels"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { JudgeConnectionsStep } from "./judge-connections.step"

const claimed = (payload: object = { marker: "payload-1" }): ClaimedJob => ({
    jobId: "job-1",
    kind: "connection_health",
    fencingToken: 9,
    currentStep: null,
    payload,
})

const build = async () => {
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    const service = mock<ConnectionHealthService>()
    service.checkFromJob.mockResolvedValue({ checked: 3, ok: 1, silent: 1, failing: 1, changed: 2 })
    const moduleRef = await Test.createTestingModule({
        providers: [JudgeConnectionsStep, { provide: ConnectionHealthService, useValue: service }],
    })
        .useMocker((token) =>
            typeof token === "symbol" && token.description === "platform.jobs.claims" ? claims : undefined,
        )
        .compile()
    return { step: moduleRef.get(JudgeConnectionsStep), claims, service }
}

describe("JudgeConnectionsStep", () => {
    it("records the judge step under the held fencing token before it delegates the payload", async () => {
        const { step, claims, service } = await build()
        let release: () => void = () => undefined
        claims.advance.mockReturnValue(
            new Promise<void>((resolve) => {
                release = resolve
            }),
        )

        const running = step.run(claimed())

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 9, step: "judge" }]])
        expect(service.checkFromJob).not.toHaveBeenCalled()
        release()
        await expect(running).resolves.toBeUndefined()
        expect(service.checkFromJob.mock.calls).toEqual([[{ marker: "payload-1" }]])
    })

    it("stops on a stale token before any effect", async () => {
        const { step, claims, service } = await build()
        const refusal = new Error("JOBS_FENCED_OUT")
        claims.advance.mockRejectedValue(refusal)

        await expect(step.run(claimed())).rejects.toBe(refusal)

        expect(service.checkFromJob).not.toHaveBeenCalled()
    })

    it("propagates a failure of the delegated work", async () => {
        const { step, service } = await build()
        const failure = new Error("unavailable")
        service.checkFromJob.mockRejectedValue(failure)

        await expect(step.run(claimed())).rejects.toBe(failure)
    })
})
