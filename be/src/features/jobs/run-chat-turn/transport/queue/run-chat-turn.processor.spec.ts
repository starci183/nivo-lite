import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { ClaimedJob } from "@modules/platform/jobs"
import { ReplyStep } from "../../steps/reply.step"
import { RunChatTurnProcessor } from "./run-chat-turn.processor"

const job: ClaimedJob = {
    jobId: "job-1",
    kind: "chat-turn.turn",
    fencingToken: 7,
    currentStep: null,
    payload: {
        kind: "turn",
        workspaceId: "ws-1",
        conversationId: "conv-1",
        messageId: "msg-1",
        channelEventId: "tg:555:9",
        lookupName: false,
    },
}

const build = async () => {
    const reply = mock<ReplyStep>()
    reply.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [RunChatTurnProcessor, { provide: ReplyStep, useValue: reply }],
    }).compile()
    return { processor: moduleRef.get(RunChatTurnProcessor), reply }
}

describe("RunChatTurnProcessor", () => {
    it("consumes the chat-turn queue", async () => {
        const { processor } = await build()

        expect(processor.queue).toBe("chat_turn")
    })

    it("passes the fenced claim to the reply step exactly once and awaits its completion", async () => {
        const { processor, reply } = await build()
        let finishStep = () => {}
        const pending = new Promise<void>((resolve) => {
            finishStep = resolve
        })
        reply.run.mockReturnValue(pending)
        const finished = jest.fn()

        const processing = processor.process(job).then(finished)
        await Promise.resolve()

        expect(reply.run.mock.calls).toEqual([[job]])
        expect(reply.run.mock.calls[0]?.[0]).toBe(job)
        expect(finished).not.toHaveBeenCalled()

        finishStep()

        await expect(processing).resolves.toBeUndefined()
        expect(finished.mock.calls).toEqual([[undefined]])
        expect(reply.run.mock.calls).toEqual([[job]])
    })

    it("propagates the reply step failure unchanged", async () => {
        const { processor, reply } = await build()
        const failure = new Error("claim was fenced out")
        reply.run.mockRejectedValue(failure)

        await expect(processor.process(job)).rejects.toBe(failure)
        expect(reply.run.mock.calls).toEqual([[job]])
    })
})
