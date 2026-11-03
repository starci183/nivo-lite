import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { Brief } from "@nivo-lite/agent-sdk/reconcile"
import { UsageMeterService } from "@modules/domain/knowledge"
import { AI } from "@modules/integrations/ai"
import type { AiChatAnswer, AiService } from "@modules/integrations/ai"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OrderPaymentJudgeService } from "./order-payment-judge.service"
import { WorkPerformersLogEvent } from "./work-performers.log-events"

const BRIEF: Brief = {
    arrival: { id: "a", amount: 5000, text: "BUI NGUYEN DINH", names: [], at: 0 },
    candidates: [],
    claims: [],
}

const ANSWER = { verdict: "match", candidate_id: "order-1", reasons: ["name and amount agree"] }

const answerOf = (over: Partial<AiChatAnswer> = {}): AiChatAnswer => ({
    text: JSON.stringify(ANSWER),
    parsed: ANSWER,
    model: "m1",
    usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120, costUsd: 0.001 },
    retrieved: 0,
    ...over,
})

const build = async () => {
    const ai = mock<AiService>()
    const usage = mock<UsageMeterService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrderPaymentJudgeService,
            { provide: AI, useValue: ai },
            { provide: UsageMeterService, useValue: usage },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { judge: moduleRef.get(OrderPaymentJudgeService), ai, usage, logger }
}

describe("OrderPaymentJudgeService", () => {
    it("asks the model in JSON mode with the brief, meters the call and answers the judgement", async () => {
        const { judge, ai, usage } = await build()
        ai.chat.mockResolvedValue(answerOf())

        await expect(judge.judge("ws-1", BRIEF)).resolves.toEqual({
            verdict: "match",
            candidateId: "order-1",
            reasons: ["name and amount agree"],
        })

        expect(ai.chat).toHaveBeenCalledWith(expect.objectContaining({ json: true, context: null }))
        expect(usage.record).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceId: "ws-1", kind: "engine", module: "accounting", model: "m1" }),
        )
    })

    it("reads the JSON in the text when the structured output is missing", async () => {
        const { judge, ai } = await build()
        ai.chat.mockResolvedValue(answerOf({ parsed: null, text: `Here: ${JSON.stringify(ANSWER)} done` }))
        await expect(judge.judge("ws-1", BRIEF)).resolves.toMatchObject({ verdict: "match" })
    })

    it("answers null when the model is unavailable", async () => {
        const { judge, ai, usage } = await build()
        ai.chat.mockResolvedValue(null)
        await expect(judge.judge("ws-1", BRIEF)).resolves.toBeNull()
        expect(usage.record).not.toHaveBeenCalled()
    })

    it("answers null and logs when the answer is no judgement", async () => {
        const { judge, ai, logger } = await build()
        ai.chat.mockResolvedValueOnce(answerOf({ parsed: null, text: "no idea" }))
        ai.chat.mockResolvedValueOnce(answerOf({ parsed: null, text: "{ not json }" }))
        ai.chat.mockResolvedValueOnce(answerOf({ parsed: null, text: '{"verdict":"maybe"}' }))

        await expect(judge.judge("ws-1", BRIEF)).resolves.toBeNull()
        await expect(judge.judge("ws-1", BRIEF)).resolves.toBeNull()
        await expect(judge.judge("ws-1", BRIEF)).resolves.toBeNull()

        expect(logger.warn).toHaveBeenCalledWith(WorkPerformersLogEvent.JudgementUnreadable, { workspaceId: "ws-1" })
        expect(logger.warn).toHaveBeenCalledTimes(3)
    })
})
