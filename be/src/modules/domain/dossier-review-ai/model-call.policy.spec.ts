import { Injectable } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { z } from "zod"
import { UsageMeterService } from "@modules/domain/knowledge"
import { AI, InjectAi } from "@modules/integrations/ai"
import type { AiChatAnswer, AiChatAttempt, AiCutSpend, AiService } from "@modules/integrations/ai"
import { InjectLogger, LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ModelCallResult } from "./dossier-review-ai.contracts"
import { DossierReviewAiLogEvent } from "./dossier-review-ai.log-events"
import { ModelCallPolicy } from "./model-call.policy"

const SCHEMA = z.object({ title: z.string().max(50) })
type ProbeAnswer = z.infer<typeof SCHEMA>
const VALUE: ProbeAnswer = { title: "T" }
const VALUE_JSON = JSON.stringify(VALUE)
const WS = "11111111-1111-4111-8111-111111111111"

@Injectable()
class ProbeService extends ModelCallPolicy {
    constructor(@InjectAi() ai: AiService, usage: UsageMeterService, @InjectLogger() logger: Logger) {
        super(ai, usage, logger)
    }

    run(): Promise<ModelCallResult<ProbeAnswer> | "unreadable" | "unavailable" | "cut"> {
        return this.askOnce({
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
    // The policy calls `attempt` (a cut answer is booked, D-BR-15); these cases script `chat`, which `attempt` wraps.
    ai.attempt.mockImplementation(async (request) => {
        const answer = await ai.chat(request)
        return answer === null ? { ok: false, failure: "provider" } : { ok: true, answer }
    })
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

    it("answers unavailable at once when the model is unavailable, with no usage", async () => {
        const { probe, ai, usage } = await build()
        ai.chat.mockResolvedValue(null)

        await expect(probe.run()).resolves.toBe("unavailable")

        expect(ai.chat).toHaveBeenCalledTimes(1)
        expect(usage.record).not.toHaveBeenCalled()
    })

    it("answers unreadable for an answer that does not fit the schema, books it and asks nothing again", async () => {
        const { probe, ai, usage, logger } = await build()
        ai.chat.mockResolvedValue(answerOf({ parsed: null, text: "no json" }))

        await expect(probe.run()).resolves.toBe("unreadable")

        expect(ai.chat).toHaveBeenCalledTimes(1)
        expect(usage.record).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledWith(DossierReviewAiLogEvent.AnswerUnreadable, { purpose: "probe", attempt: 1 })
    })
})

describe("ModelCallPolicy: a cut answer is booked (D-BR-15)", () => {
    it("books what a call cut at the token cap spent and answers cut", async () => {
        const { probe, ai, usage, logger } = await build()
        const spent: AiCutSpend = {
            model: "claude-haiku-5-5",
            usage: { promptTokens: 900, completionTokens: 1000, totalTokens: 1900, costUsd: 0.002 },
            served: { upstream: null, finishReason: "length", durationMs: 10 },
            cap: 1000,
        }
        ai.attempt.mockReset()
        const cut: AiChatAttempt = { ok: false, failure: "length", spent }
        ai.attempt.mockResolvedValueOnce(cut)

        await expect(probe.run()).resolves.toBe("cut")

        expect(ai.attempt).toHaveBeenCalledTimes(1)
        expect(usage.record).toHaveBeenCalledTimes(1)
        expect(usage.record).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ kind: "brain", model: "claude-haiku-5-5", usage: spent.usage, completionChars: 0, failure: "length" }),
        )
        expect(logger.warn).toHaveBeenCalledWith(DossierReviewAiLogEvent.AnswerCut, { purpose: "probe", attempt: 1, cap: 1000 })
    })
})

describe("ModelCallPolicy reading", () => {
    it("reads the object out of a fenced answer when the structured output is missing", async () => {
        const { probe, ai } = await build()
        const fence = "`".repeat(3)
        ai.chat.mockResolvedValue(answerOf({ parsed: null, text: `Here:\n${fence}json\n${VALUE_JSON}\n${fence}` }))

        await expect(probe.run()).resolves.toMatchObject({ value: VALUE })
    })

    it("logs braces that do not hold JSON and treats a closing brace before an opening one as no JSON", async () => {
        const { probe, ai, logger } = await build()
        ai.chat
            .mockResolvedValueOnce(answerOf({ parsed: null, text: "{broken}" }))
            .mockResolvedValueOnce(answerOf({ parsed: null, text: "} {" }))

        await expect(probe.run()).resolves.toBe("unreadable")
        await expect(probe.run()).resolves.toBe("unreadable")

        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(DossierReviewAiLogEvent.JsonUnreadable, expect.any(SyntaxError))
    })
})
