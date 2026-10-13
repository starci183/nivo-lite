import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { ClaimedJob } from "@modules/platform/jobs"
import { ApplyStep } from "../../steps/apply.step"
import { ApplyBookingStatusProcessor } from "./apply-booking-status.processor"

const job: ClaimedJob = {
    jobId: "job-1",
    kind: "booking-status.apply",
    fencingToken: 7,
    currentStep: null,
    payload: {
        workspaceId: "ws-1",
        bookingId: "booking-1",
        kind: "status",
    },
}

const build = async () => {
    const apply = mock<ApplyStep>()
    apply.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [ApplyBookingStatusProcessor, { provide: ApplyStep, useValue: apply }],
    }).compile()
    return { processor: moduleRef.get(ApplyBookingStatusProcessor), apply }
}

describe("ApplyBookingStatusProcessor", () => {
    it("consumes the booking-status queue", async () => {
        const { processor } = await build()

        expect(processor.queue).toBe("booking_status")
    })

    it("passes the fenced claim to the apply step exactly once and awaits its completion", async () => {
        const { processor, apply } = await build()
        let finishStep = () => {}
        const pending = new Promise<void>((resolve) => {
            finishStep = resolve
        })
        apply.run.mockReturnValue(pending)
        const finished = jest.fn()

        const processing = processor.process(job).then(finished)
        await Promise.resolve()

        expect(apply.run.mock.calls).toEqual([[job]])
        expect(apply.run.mock.calls[0]?.[0]).toBe(job)
        expect(finished).not.toHaveBeenCalled()

        finishStep()

        await expect(processing).resolves.toBeUndefined()
        expect(finished.mock.calls).toEqual([[undefined]])
        expect(apply.run.mock.calls).toEqual([[job]])
    })

    it("propagates the apply step failure unchanged", async () => {
        const { processor, apply } = await build()
        const failure = new Error("claim was fenced out")
        apply.run.mockRejectedValue(failure)

        await expect(processor.process(job)).rejects.toBe(failure)
        expect(apply.run.mock.calls).toEqual([[job]])
    })
})
