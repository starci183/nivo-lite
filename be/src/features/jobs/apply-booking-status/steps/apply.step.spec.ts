import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BookingEffectsService } from "@modules/domain/bookings"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { ApplyStep } from "./apply.step"

const payload = {
    workspaceId: "ws-1",
    bookingId: "booking-1",
    kind: "created",
} as const

const claimed = (body: object = payload): ClaimedJob => ({
    jobId: "job-1",
    kind: "booking-status.apply",
    fencingToken: 7,
    currentStep: null,
    payload: body,
})

const build = async () => {
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    const effects = mock<BookingEffectsService>()
    effects.apply.mockResolvedValue({
        found: true,
        reminders: "planned",
        feeVnd: 0,
        handedOff: false,
        notified: true,
    })
    const moduleRef = await Test.createTestingModule({
        providers: [ApplyStep, { provide: BookingEffectsService, useValue: effects }],
    })
        .useMocker((token) =>
            typeof token === "symbol" && token.description === "platform.jobs.claims" ? claims : undefined,
        )
        .compile()
    return { step: moduleRef.get(ApplyStep), claims, effects }
}

describe("ApplyStep", () => {
    it("waits for the apply write under the held fencing token before applying the booking change", async () => {
        const { step, claims, effects } = await build()
        let release: () => void = () => undefined
        const advanced = new Promise<void>((resolve) => {
            release = resolve
        })
        claims.advance.mockReturnValue(advanced)

        const running = step.run(claimed())

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "apply" }]])
        expect(effects.apply).not.toHaveBeenCalled()
        release()
        await expect(running).resolves.toBeUndefined()
        expect(effects.apply.mock.calls).toEqual([[payload]])
    })

    it.each(["status", "moved"] as const)("applies a %s change with only its delivery fields", async (kind) => {
        const { step, claims, effects } = await build()
        const change = { ...payload, kind, extra: "ignored" }

        await expect(step.run(claimed(change))).resolves.toBeUndefined()

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "apply" }]])
        expect(effects.apply.mock.calls).toEqual([[{ workspaceId: "ws-1", bookingId: "booking-1", kind }]])
    })

    it("forwards normalized unreadable delivery fields after recording the fenced step", async () => {
        const { step, claims, effects } = await build()

        await expect(step.run(claimed({ workspaceId: 1, bookingId: false, kind: "other" }))).resolves.toBeUndefined()

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "apply" }]])
        expect(effects.apply.mock.calls).toEqual([[{ workspaceId: "", bookingId: "", kind: "status" }]])
    })

    it("propagates a stale-token refusal before applying any booking effect", async () => {
        const { step, claims, effects } = await build()
        const refusal = new Error("JOBS_FENCED_OUT")
        claims.advance.mockRejectedValue(refusal)

        await expect(step.run(claimed())).rejects.toBe(refusal)

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "apply" }]])
        expect(effects.apply).not.toHaveBeenCalled()
    })

    it("propagates the booking effect failure after recording the fenced step", async () => {
        const { step, claims, effects } = await build()
        const failure = new Error("booking effect unavailable")
        effects.apply.mockRejectedValue(failure)

        await expect(step.run(claimed())).rejects.toBe(failure)

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "apply" }]])
        expect(effects.apply.mock.calls).toEqual([[payload]])
    })
})
