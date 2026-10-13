import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ZaloCredentialsService } from "@modules/domain/channels"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { RenewTokensStep } from "./renew-tokens.step"

const claimed = (payload: object = { withinMs: 3_600_000 }): ClaimedJob => ({
    jobId: "refresh-job-1",
    kind: "zalo_refresh",
    fencingToken: 11,
    currentStep: null,
    payload,
})

const build = async () => {
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    const credentials = mock<ZaloCredentialsService>()
    credentials.refreshDue.mockResolvedValue({ refreshed: 2, failed: 0 })
    const moduleRef = await Test.createTestingModule({
        providers: [RenewTokensStep, { provide: ZaloCredentialsService, useValue: credentials }],
    })
        .useMocker((token) =>
            typeof token === "symbol" && token.description === "platform.jobs.claims" ? claims : undefined,
        )
        .compile()
    return { step: moduleRef.get(RenewTokensStep), claims, credentials }
}

describe("RenewTokensStep", () => {
    it("waits for the renew write under the held fencing token before refreshing due credentials", async () => {
        const { step, claims, credentials } = await build()
        let release: () => void = () => undefined
        const advanced = new Promise<void>((resolve) => {
            release = resolve
        })
        claims.advance.mockReturnValue(advanced)

        const running = step.run(claimed())

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "refresh-job-1", expectedFencingToken: 11, step: "renew" }],
        ])
        expect(credentials.refreshDue).not.toHaveBeenCalled()
        release()
        await expect(running).resolves.toBeUndefined()
        expect(credentials.refreshDue.mock.calls).toEqual([[3_600_000]])
    })

    it("passes a zero-millisecond horizon through to the refresh", async () => {
        const { step, claims, credentials } = await build()

        await expect(step.run(claimed({ withinMs: 0 }))).resolves.toBeUndefined()

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "refresh-job-1", expectedFencingToken: 11, step: "renew" }],
        ])
        expect(credentials.refreshDue.mock.calls).toEqual([[0]])
    })

    it.each([{}, { withinMs: "3600000" }])("uses seven hours for an invalid refresh tick: %p", async (payload) => {
        const { step, claims, credentials } = await build()

        await expect(step.run(claimed(payload))).resolves.toBeUndefined()

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "refresh-job-1", expectedFencingToken: 11, step: "renew" }],
        ])
        expect(credentials.refreshDue.mock.calls).toEqual([[25_200_000]])
    })

    it("propagates a stale-token refusal before refreshing any credential", async () => {
        const { step, claims, credentials } = await build()
        const refusal = new Error("JOBS_FENCED_OUT")
        claims.advance.mockRejectedValue(refusal)

        await expect(step.run(claimed())).rejects.toBe(refusal)

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "refresh-job-1", expectedFencingToken: 11, step: "renew" }],
        ])
        expect(credentials.refreshDue).not.toHaveBeenCalled()
    })

    it("propagates a refresh failure after recording the fenced step", async () => {
        const { step, claims, credentials } = await build()
        const failure = new Error("credentials unavailable")
        credentials.refreshDue.mockRejectedValue(failure)

        await expect(step.run(claimed())).rejects.toBe(failure)

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "refresh-job-1", expectedFencingToken: 11, step: "renew" }],
        ])
        expect(credentials.refreshDue.mock.calls).toEqual([[3_600_000]])
    })
})
