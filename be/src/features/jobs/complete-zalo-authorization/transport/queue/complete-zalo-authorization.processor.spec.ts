import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { ClaimedJob } from "@modules/platform/jobs"
import { CompleteAuthorizationStep } from "../../steps/complete-authorization.step"
import { CompleteZaloAuthorizationProcessor } from "./complete-zalo-authorization.processor"

const job: ClaimedJob = {
    jobId: "authorization-job-1",
    kind: "zalo_authorization",
    fencingToken: 7,
    currentStep: null,
    payload: { workspaceId: "workspace-1", state: "connection-1.nonce-1", code: "code-1", oaId: "oa-1" },
}

const build = async () => {
    const complete = mock<CompleteAuthorizationStep>()
    complete.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [CompleteZaloAuthorizationProcessor, { provide: CompleteAuthorizationStep, useValue: complete }],
    }).compile()
    return { processor: moduleRef.get(CompleteZaloAuthorizationProcessor), complete }
}

describe("CompleteZaloAuthorizationProcessor", () => {
    it("consumes the Zalo authorization queue", async () => {
        const { processor } = await build()

        expect(processor.queue).toBe("zalo_authorization")
    })

    it("passes the fenced claim to the completion step exactly once and awaits its completion", async () => {
        const { processor, complete } = await build()
        let finishStep = () => {}
        const pending = new Promise<void>((resolve) => {
            finishStep = resolve
        })
        complete.run.mockReturnValue(pending)
        const finished = jest.fn()

        const processing = processor.process(job).then(finished)
        await Promise.resolve()

        expect(complete.run.mock.calls).toEqual([[job]])
        expect(complete.run.mock.calls[0]?.[0]).toBe(job)
        expect(finished).not.toHaveBeenCalled()

        finishStep()

        await expect(processing).resolves.toBeUndefined()
        expect(finished.mock.calls).toEqual([[undefined]])
        expect(complete.run.mock.calls).toEqual([[job]])
    })

    it("propagates the completion step failure unchanged", async () => {
        const { processor, complete } = await build()
        const failure = new Error("claim was fenced out")
        complete.run.mockRejectedValue(failure)

        await expect(processor.process(job)).rejects.toBe(failure)
        expect(complete.run.mock.calls).toEqual([[job]])
    })
})
