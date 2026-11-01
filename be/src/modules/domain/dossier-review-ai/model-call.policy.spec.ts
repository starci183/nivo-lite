import { Injectable } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { UsageMeterService } from "@modules/domain/knowledge"
import { AI, InjectAi } from "@modules/integrations/ai"
import type { AiChatAnswer, AiService } from "@modules/integrations/ai"
import { InjectLogger, LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { OptionalCallResult } from "./dossier-review-ai.contracts"
import { DossierReviewAiLogEvent } from "./dossier-review-ai.log-events"
import { ModelCallPolicy } from "./model-call.policy"
import { REMEDY_SCHEMA } from "./remedy.schema"
import type { RemedyAnswer } from "./remedy.schema"

const SCHEMA = REMEDY_SCHEMA
const VALUE: RemedyAnswer = { title: "T", documentType: "D", body: "B", placeholders: [] }
const VALUE_JSON = JSON.stringify(VALUE)
const WS = "11111111-1111-4111-8111-111111111111"

@Injectable()
class ProbeService extends ModelCallPolicy {
    constructor(@InjectAi() ai: AiService, usage: UsageMeterService, @InjectLogger() logger: Logger) {
        super(ai, usage, logger)
    }

    run(): Promise<OptionalCallResult<RemedyAnswer>> {
        return this.ask({
            workspaceId: WS,
            system: "sys",
            user: "usr",
            schema: SCHEMA,
            timeoutMs: 1000,
            purpose: "probe",
            budget: { effort: "low", maxTokens: 1000 },
        })
    }
}

const answerOf = builder<AiChatAnswer>({
    text: VALUE_JSON,
    parsed: VALUE,
    model: "m1",
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, costUsd: null },
    retrieved: 0,
})

const build = async () => {
    const ai = mock<AiService>()
    const usage = mock<UsageMeterService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ProbeService,
            { provide: AI, useValue: ai },
            { provide: UsageMeterService, useValue: usage },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { probe: moduleRef.get(ProbeService), ai, usage, logger }
}

describe("ModelCallPolicy", () => {
    it("answers the parsed value with the tokens of the one call", async () => {
        const { probe, ai, usage } = await build()
        ai.chat.mockResolvedValue(answerOf())

        await expect(probe.run()).resolves.toEqual({
            value: VALUE,
            model: "m1",
            promptTokens: 10,
            completionTokens: 5,
        })

        expect(ai.chat).toHaveBeenCalledWith({
            messages: [
                { role: "system", content: "sys" },
                { role: "user", content: "usr" },
            ],
            json: true,
            schema: SCHEMA,
            timeoutMs: 1000,
            budget: { effort: "low", maxTokens: 1000 },
            context: null,
        })
        expect(usage.record).toHaveBeenCalledTimes(1)
    })

    it("answers null at once when the model is unavailable", async () => {
        const { probe, ai, usage } = await build()
        ai.chat.mockResolvedValue(null)

        await expect(probe.run()).resolves.toBeNull()

        expect(ai.chat).toHaveBeenCalledTimes(1)
        expect(usage.record).not.toHaveBeenCalled()
    })
})

describe("ModelCallPolicy retry", () => {
    it("asks once more after an unreadable answer and sums the tokens of both calls", async () => {
        const { probe, ai, usage, logger } = await build()
        ai.chat.mockResolvedValueOnce(answerOf({ parsed: null, text: "no json" })).mockResolvedValueOnce(answerOf())

        await expect(probe.run()).resolves.toEqual({
            value: VALUE,
            model: "m1",
            promptTokens: 20,
            completionTokens: 10,
        })

        expect(usage.record).toHaveBeenCalledTimes(2)
        expect(logger.warn).toHaveBeenCalledWith(DossierReviewAiLogEvent.AnswerUnreadable, {
            purpose: "probe",
            attempt: 1,
        })
    })

    it("answers null and logs that it gave up after two unreadable answers", async () => {
        const { probe, ai, logger } = await build()
        ai.chat.mockResolvedValue(answerOf({ parsed: null, text: "no json" }))

        await expect(probe.run()).resolves.toBeNull()

        expect(logger.warn).toHaveBeenLastCalledWith(DossierReviewAiLogEvent.AnswerGivenUp, { purpose: "probe" })
    })

    it("answers null when the retry finds the model unavailable", async () => {
        const { probe, ai } = await build()
        ai.chat.mockResolvedValueOnce(answerOf({ parsed: null, text: "no json" })).mockResolvedValueOnce(null)

        await expect(probe.run()).resolves.toBeNull()
    })

    it("reads the object out of a fenced answer when the structured output is missing", async () => {
        const { probe, ai } = await build()
        const fence = "`".repeat(3)
        ai.chat.mockResolvedValue(answerOf({ parsed: null, text: `Here:\n${fence}json\n${VALUE_JSON}\n${fence}` }))

        const result = await probe.run()

        expect(result?.value).toEqual(VALUE)
    })

    it("logs braces that do not hold JSON and treats a closing brace before an opening one as no JSON", async () => {
        const { probe, ai, logger } = await build()
        ai.chat
            .mockResolvedValueOnce(answerOf({ parsed: null, text: "{broken}" }))
            .mockResolvedValueOnce(answerOf({ parsed: null, text: "} {" }))

        await expect(probe.run()).resolves.toBeNull()

        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(DossierReviewAiLogEvent.JsonUnreadable, expect.any(SyntaxError))
    })

    it("reports null tokens when no call reported any and the sum of those that did", async () => {
        const { probe, ai } = await build()
        const none = { promptTokens: null, completionTokens: null, totalTokens: null, costUsd: null }
        const some = { promptTokens: 7, completionTokens: null, totalTokens: null, costUsd: null }
        ai.chat
            .mockResolvedValueOnce(answerOf({ parsed: null, text: "x", usage: none }))
            .mockResolvedValueOnce(answerOf({ usage: none }))
        await expect(probe.run()).resolves.toMatchObject({ promptTokens: null, completionTokens: null })

        ai.chat
            .mockResolvedValueOnce(answerOf({ parsed: null, text: "x", usage: some }))
            .mockResolvedValueOnce(answerOf({ usage: none }))
        await expect(probe.run()).resolves.toMatchObject({ promptTokens: 7, completionTokens: null })
    })
})
