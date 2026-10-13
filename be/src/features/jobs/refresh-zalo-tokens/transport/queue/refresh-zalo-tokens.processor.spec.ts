import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { ClaimedJob } from "@modules/platform/jobs"
import { RenewTokensStep } from "../../steps/renew-tokens.step"
import { RefreshZaloTokensProcessor } from "./refresh-zalo-tokens.processor"

const job: ClaimedJob = {
    jobId: "job-1",
    kind: "zalo_refresh",
    fencingToken: 7,
    currentStep: null,
    payload: { withinMs: 25_200_000 },
}

const build = async () => {
    const renew = mock<RenewTokensStep>()
    renew.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [RefreshZaloTokensProcessor, { provide: RenewTokensStep, useValue: renew }],
    }).compile()
    return { processor: moduleRef.get(RefreshZaloTokensProcessor), renew }
}

describe("RefreshZaloTokensProcessor", () => {
    it("consumes the Zalo refresh queue", async () => {
        const { processor } = await build()

        expect(processor.queue).toBe("zalo_refresh")
    })

    it("passes the fenced claim to the renewal step exactly once and awaits its completion", async () => {
        const { processor, renew } = await build()
        let finishStep = () => {}
        const pending = new Promise<void>((resolve) => {
            finishStep = resolve
        })
        renew.run.mockReturnValue(pending)
        const finished = jest.fn()

        const processing = processor.process(job).then(finished)
        await Promise.resolve()

        expect(renew.run.mock.calls).toEqual([[job]])
        expect(renew.run.mock.calls[0]?.[0]).toBe(job)
        expect(finished).not.toHaveBeenCalled()

        finishStep()

        await expect(processing).resolves.toBeUndefined()
        expect(finished.mock.calls).toEqual([[undefined]])
        expect(renew.run.mock.calls).toEqual([[job]])
    })

    it("propagates the renewal step failure unchanged", async () => {
        const { processor, renew } = await build()
        const failure = new Error("claim was fenced out")
        renew.run.mockRejectedValue(failure)

        await expect(processor.process(job)).rejects.toBe(failure)
        expect(renew.run.mock.calls).toEqual([[job]])
    })
})
