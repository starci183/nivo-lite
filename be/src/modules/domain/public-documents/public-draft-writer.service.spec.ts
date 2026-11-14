import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { UsageMeterService } from "@modules/domain/knowledge"
import { AI } from "@modules/integrations/ai"
import type { AiChatAnswer, AiService } from "@modules/integrations/ai"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DRAFT_SYSTEM_PROMPT, PUBLIC_DRAFT_PROMPT_VERSION, draftPrompt } from "./draft-prompt.policy"
import { DRAFT_OUTPUT_SCHEMA } from "./draft-answer.policy"
import { DRAFT_READ_SCHEMA } from "./draft.schema"
import { PublicDraftWriterService } from "./public-draft-writer.service"
import type { PublicDraftBrief } from "./public-documents.contracts"

const WS = "11111111-1111-4111-8111-111111111111"
/** A laundry's public document. */
const brief: PublicDraftBrief = {
    workspaceId: WS,
    title: "Services",
    question: null,
    instructions: null,
    sources: [
        { sourceId: "s1", title: "Price list", text: "Wash and fold in 24 hours.", cut: false },
    ],
}
const READING = { answers: true, body: "Wash and fold is ready in 24 hours." }
const answerOf = builder<AiChatAnswer>({
    text: JSON.stringify(READING),
    parsed: READING,
    model: "m1",
    usage: { promptTokens: 300, completionTokens: 90, totalTokens: 390, costUsd: null },
    retrieved: 0,
})

const build = async () => {
    const ai = mock<AiService>()
    const usage = mock<UsageMeterService>()
    usage.blockedBy.mockResolvedValue(false)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicDraftWriterService,
            { provide: AI, useValue: ai },
            { provide: UsageMeterService, useValue: usage },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { writer: moduleRef.get(PublicDraftWriterService), ai, usage, logger }
}

describe("PublicDraftWriterService", () => {
    it("asks the model once with the prompt, the read schema and the closed structured output, and answers its answer", async () => {
        const { writer, ai, logger } = await build()
        ai.attempt.mockResolvedValue({ ok: true, answer: answerOf() })

        await expect(writer.write(brief)).resolves.toEqual(READING)

        expect(ai.attempt).toHaveBeenCalledTimes(1)
        expect(ai.attempt).toHaveBeenCalledWith({
            messages: [
                { role: "system", content: DRAFT_SYSTEM_PROMPT },
                { role: "user", content: draftPrompt(brief) },
            ],
            json: true,
            schema: DRAFT_READ_SCHEMA,
            outputSchema: DRAFT_OUTPUT_SCHEMA,
            timeoutMs: 90_000,
            context: null,
        })
        expect(logger.info).toHaveBeenCalledWith("public_documents.draft.read", {
            promptVersion: PUBLIC_DRAFT_PROMPT_VERSION,
            attempt: 1,
            answers: true,
            bodyChars: READING.body.length,
        })
    })

    it("records the usage under the kind brain and the module public_documents", async () => {
        const { writer, ai, usage } = await build()
        ai.attempt.mockResolvedValue({ ok: true, answer: answerOf() })

        await writer.write(brief)

        expect(usage.record).toHaveBeenCalledWith({
            workspaceId: WS,
            kind: "brain",
            module: "public_documents",
            model: "m1",
            usage: { promptTokens: 300, completionTokens: 90, totalTokens: 390, costUsd: null },
            promptChars: DRAFT_SYSTEM_PROMPT.length + draftPrompt(brief).length,
            completionChars: JSON.stringify(READING).length,
            tryNumber: 1,
        })
    })

})

describe("PublicDraftWriterService: unreadable answers and the bounded retry", () => {
    it("reads the JSON out of the text when the structured answer is missing", async () => {
        const { writer, ai } = await build()
        ai.attempt.mockResolvedValue({
            ok: true,
            answer: answerOf({ parsed: null, text: `Here:\n\`\`\`json\n${JSON.stringify(READING)}\n\`\`\`` }),
        })

        await expect(writer.write(brief)).resolves.toEqual(READING)
    })

    it("answers null without a retry when the model is unavailable", async () => {
        const { writer, ai } = await build()
        ai.attempt.mockResolvedValue({ ok: false, failure: "timeout" })

        await expect(writer.write(brief)).resolves.toBeNull()
        expect(ai.attempt).toHaveBeenCalledTimes(1)
    })

    it("asks again once when the first answer does not fit and uses the second", async () => {
        const { writer, ai, usage, logger } = await build()
        ai.attempt
            .mockResolvedValueOnce({ ok: true, answer: answerOf({ parsed: { body: "old shape" }, text: "{ not json" }) })
            .mockResolvedValueOnce({ ok: true, answer: answerOf() })

        await expect(writer.write(brief)).resolves.toEqual(READING)
        expect(usage.record).toHaveBeenCalledTimes(2)
        expect(logger.warn).toHaveBeenCalledWith("public_documents.answer.unreadable", {
            attempt: 1,
            promptVersion: PUBLIC_DRAFT_PROMPT_VERSION,
        })
    })

    it.each(["no json here", "{ not json }", '{"usable":[1],"excluded":[],"paragraphs":[]}', '{"answers":"yes","body":"x"}'])(
        "answers null after two unreadable answers and never calls a third time: %s",
        async (text) => {
            const { writer, ai } = await build()
            ai.attempt.mockResolvedValue({ ok: true, answer: answerOf({ parsed: null, text }) })

            await expect(writer.write(brief)).resolves.toBeNull()
            expect(ai.attempt).toHaveBeenCalledTimes(2)
        },
    )
})

describe("PublicDraftWriterService: cut tries and the credit pool", () => {
    const spent = { promptTokens: 300, completionTokens: 4000, totalTokens: 4300, costUsd: null }
    const served = { upstream: "anthropic", finishReason: "max_tokens", durationMs: 5 }

    it("does not retry when the credit pool is empty after an unreadable answer", async () => {
        const { writer, ai, usage } = await build()
        ai.attempt.mockResolvedValueOnce({ ok: true, answer: answerOf({ parsed: null, text: "{ not json" }) })
        usage.blockedBy.mockResolvedValue(true)

        await expect(writer.write(brief)).resolves.toBeNull()

        expect(ai.attempt).toHaveBeenCalledTimes(1)
        expect(usage.blockedBy).toHaveBeenCalledWith(WS, "brain", false)
    })

    it("answers null for a cut answer and books what it spent", async () => {
        const { writer, ai, usage } = await build()
        ai.attempt.mockResolvedValue({
            ok: false,
            failure: "length",
            spent: { model: "claude-haiku-5-5", usage: spent, served, cap: null },
        })

        await expect(writer.write(brief)).resolves.toBeNull()
        expect(usage.record).toHaveBeenCalledTimes(1)
        expect(usage.record).toHaveBeenCalledWith(
            expect.objectContaining({ model: "claude-haiku-5-5", usage: spent, completionChars: 0 }),
        )
    })
})
