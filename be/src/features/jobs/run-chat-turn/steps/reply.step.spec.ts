import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChatTurnService } from "@modules/domain/conversations"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import type { ChatTurnPayload } from "@modules/queues/chat-turn"
import { ReplyStep } from "./reply.step"

const payload: ChatTurnPayload = {
    kind: "turn",
    workspaceId: "ws-1",
    conversationId: "conversation-1",
    messageId: "message-1",
    channelEventId: "event-1",
    lookupName: true,
}

const claimed = (body: object = payload): ClaimedJob => ({
    jobId: "job-1",
    kind: "chat-turn.turn",
    fencingToken: 7,
    currentStep: null,
    payload: body,
})

const build = async () => {
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    const chatTurns = mock<ChatTurnService>()
    chatTurns.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [ReplyStep, { provide: ChatTurnService, useValue: chatTurns }],
    })
        .useMocker((token) =>
            typeof token === "symbol" && token.description === "platform.jobs.claims" ? claims : undefined,
        )
        .compile()
    return { step: moduleRef.get(ReplyStep), claims, chatTurns }
}

describe("ReplyStep", () => {
    it("waits for the reply write under the held fencing token before answering the customer", async () => {
        const { step, claims, chatTurns } = await build()
        let release: () => void = () => undefined
        const advanced = new Promise<void>((resolve) => {
            release = resolve
        })
        claims.advance.mockReturnValue(advanced)

        const running = step.run(claimed())

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "reply" }]])
        expect(chatTurns.run).not.toHaveBeenCalled()
        release()
        await expect(running).resolves.toBeUndefined()
        expect(chatTurns.run.mock.calls).toEqual([[payload]])
    })

    it("runs a stored greeting with its delivery payload", async () => {
        const { step, claims, chatTurns } = await build()
        const greeting: ChatTurnPayload = { ...payload, kind: "deliver", messageId: "greeting-1", lookupName: false }

        await expect(step.run(claimed(greeting))).resolves.toBeUndefined()

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "reply" }]])
        expect(chatTurns.run.mock.calls).toEqual([[greeting]])
    })

    it.each([{}, { ...payload, kind: "other" }, { ...payload, lookupName: "yes" }])(
        "records the step without a turn when its payload is invalid: %p",
        async (body) => {
            const { step, claims, chatTurns } = await build()

            await expect(step.run(claimed(body))).resolves.toBeUndefined()

            expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "reply" }]])
            expect(chatTurns.run).not.toHaveBeenCalled()
        },
    )

    it("propagates a stale-token refusal before any customer effect", async () => {
        const { step, claims, chatTurns } = await build()
        const refusal = new Error("JOBS_FENCED_OUT")
        claims.advance.mockRejectedValue(refusal)

        await expect(step.run(claimed())).rejects.toBe(refusal)

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "reply" }]])
        expect(chatTurns.run).not.toHaveBeenCalled()
    })

    it("propagates the turn failure after recording the fenced step", async () => {
        const { step, claims, chatTurns } = await build()
        const failure = new Error("channel unavailable")
        chatTurns.run.mockRejectedValue(failure)

        await expect(step.run(claimed())).rejects.toBe(failure)

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "reply" }]])
        expect(chatTurns.run.mock.calls).toEqual([[payload]])
    })
})
