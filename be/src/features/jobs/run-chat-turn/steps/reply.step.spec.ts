import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChatTurnService } from "@modules/domain/conversations"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { ReplyStep } from "./reply.step"

const claimed = (payload: object = { marker: "payload-1" }): ClaimedJob => ({
    jobId: "job-1",
    kind: "chat_turn",
    fencingToken: 5,
    currentStep: null,
    payload,
})

const build = async () => {
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    const service = mock<ChatTurnService>()
    service.runFromJob.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [ReplyStep, { provide: ChatTurnService, useValue: service }],
    })
        .useMocker((token) =>
            typeof token === "symbol" && token.description === "platform.jobs.claims" ? claims : undefined,
        )
        .compile()
    return { step: moduleRef.get(ReplyStep), claims, service }
}

describe("ReplyStep", () => {
    it("records the reply step under the held fencing token before it delegates the payload", async () => {
        const { step, claims, service } = await build()
        let release: () => void = () => undefined
        claims.advance.mockReturnValue(
            new Promise<void>((resolve) => {
                release = resolve
            }),
        )

        const running = step.run(claimed())

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 5, step: "reply" }]])
        expect(service.runFromJob).not.toHaveBeenCalled()
        release()
        await expect(running).resolves.toBeUndefined()
        expect(service.runFromJob.mock.calls).toEqual([[{ marker: "payload-1" }]])
    })

    it("stops on a stale token before any effect", async () => {
        const { step, claims, service } = await build()
        const refusal = new Error("JOBS_FENCED_OUT")
        claims.advance.mockRejectedValue(refusal)

        await expect(step.run(claimed())).rejects.toBe(refusal)

        expect(service.runFromJob).not.toHaveBeenCalled()
    })

    it("propagates a failure of the delegated work", async () => {
        const { step, service } = await build()
        const failure = new Error("unavailable")
        service.runFromJob.mockRejectedValue(failure)

        await expect(step.run(claimed())).rejects.toBe(failure)
    })
})
