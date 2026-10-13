import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ZaloCredentialsService } from "@modules/domain/channels"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { RenewTokensStep } from "./renew-tokens.step"

const claimed = (payload: object = { marker: "payload-1" }): ClaimedJob => ({
    jobId: "job-1",
    kind: "zalo_refresh",
    fencingToken: 7,
    currentStep: null,
    payload,
})

const build = async () => {
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    const service = mock<ZaloCredentialsService>()
    service.refreshFromJob.mockResolvedValue({ refreshed: 2, failed: 1 })
    const moduleRef = await Test.createTestingModule({
        providers: [RenewTokensStep, { provide: ZaloCredentialsService, useValue: service }],
    })
        .useMocker((token) =>
            typeof token === "symbol" && token.description === "platform.jobs.claims" ? claims : undefined,
        )
        .compile()
    return { step: moduleRef.get(RenewTokensStep), claims, service }
}

describe("RenewTokensStep", () => {
    it("records the renew step under the held fencing token before it delegates the payload", async () => {
        const { step, claims, service } = await build()
        let release: () => void = () => undefined
        claims.advance.mockReturnValue(
            new Promise<void>((resolve) => {
                release = resolve
            }),
        )

        const running = step.run(claimed())

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "renew" }]])
        expect(service.refreshFromJob).not.toHaveBeenCalled()
        release()
        await expect(running).resolves.toBeUndefined()
        expect(service.refreshFromJob.mock.calls).toEqual([[{ marker: "payload-1" }]])
    })

    it("stops on a stale token before any effect", async () => {
        const { step, claims, service } = await build()
        const refusal = new Error("JOBS_FENCED_OUT")
        claims.advance.mockRejectedValue(refusal)

        await expect(step.run(claimed())).rejects.toBe(refusal)

        expect(service.refreshFromJob).not.toHaveBeenCalled()
    })

    it("propagates a failure of the delegated work", async () => {
        const { step, service } = await build()
        const failure = new Error("unavailable")
        service.refreshFromJob.mockRejectedValue(failure)

        await expect(step.run(claimed())).rejects.toBe(failure)
    })
})
