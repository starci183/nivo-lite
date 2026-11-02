import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { UsageMeterService } from "@modules/domain/knowledge"
import { AI } from "@modules/integrations/ai"
import type { AiChatAnswer, AiService } from "@modules/integrations/ai"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DRAFT_SYSTEM_PROMPT, draftPrompt } from "./draft-prompt.policy"
import { DRAFT_SCHEMA } from "./draft.schema"
import { PublicDraftWriterService } from "./public-draft-writer.service"
import type { PublicDraftBrief } from "./public-documents.contracts"

const WS = "11111111-1111-4111-8111-111111111111"
const brief: PublicDraftBrief = {
    workspaceId: WS,
    title: "Frequent questions",
    question: null,
    instructions: null,
    sources: [{ title: "Delivery policy", text: "Same day delivery." }],
}
const DRAFT = { body: " Same day delivery. " }
const answerOf = builder<AiChatAnswer>({
    text: JSON.stringify(DRAFT),
    parsed: DRAFT,
    model: "m1",
    usage: { promptTokens: 300, completionTokens: 90, totalTokens: 390, costUsd: null },
    retrieved: 0,
})

const build = async () => {
    const ai = mock<AiService>()
    const usage = mock<UsageMeterService>()
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
    it("asks the model once in JSON mode with the draft prompt and the schema, and answers the trimmed text", async () => {
        const { writer, ai } = await build()
        ai.chat.mockResolvedValue(answerOf())

        await expect(writer.write(brief)).resolves.toEqual({ body: "Same day delivery." })

        expect(ai.chat).toHaveBeenCalledTimes(1)
        expect(ai.chat).toHaveBeenCalledWith({
            messages: [
                { role: "system", content: DRAFT_SYSTEM_PROMPT },
                { role: "user", content: draftPrompt(brief) },
            ],
            json: true,
            schema: DRAFT_SCHEMA,
            timeoutMs: 90_000,
            context: null,
        })
    })

    it("records the usage under the kind brain and the module public_documents", async () => {
        const { writer, ai, usage } = await build()
        ai.chat.mockResolvedValue(answerOf())

        await writer.write(brief)

        expect(usage.record).toHaveBeenCalledWith({
            workspaceId: WS,
            kind: "brain",
            module: "public_documents",
            model: "m1",
            usage: { promptTokens: 300, completionTokens: 90, totalTokens: 390, costUsd: null },
            promptChars: DRAFT_SYSTEM_PROMPT.length + draftPrompt(brief).length,
            completionChars: JSON.stringify(DRAFT).length,
        })
    })

    it("reads the JSON out of the text when the structured answer is missing", async () => {
        const { writer, ai } = await build()
        ai.chat.mockResolvedValue(answerOf({ parsed: null, text: 'Here:\n```json\n{"body":"Open from 8"}\n```' }))

        await expect(writer.write(brief)).resolves.toEqual({ body: "Open from 8" })
    })

    it("answers null without a retry when the model is unavailable", async () => {
        const { writer, ai } = await build()
        ai.chat.mockResolvedValue(null)

        await expect(writer.write(brief)).resolves.toBeNull()
        expect(ai.chat).toHaveBeenCalledTimes(1)
    })

    it("asks again once when the first answer does not fit and uses the second", async () => {
        const { writer, ai, usage, logger } = await build()
        ai.chat
            .mockResolvedValueOnce(answerOf({ parsed: { body: "" }, text: "{ not json" }))
            .mockResolvedValueOnce(answerOf())

        await expect(writer.write(brief)).resolves.toEqual({ body: "Same day delivery." })
        expect(usage.record).toHaveBeenCalledTimes(2)
        expect(logger.warn).toHaveBeenCalledWith("public_documents.answer.unreadable", { attempt: 1 })
    })

    it.each(["no json here", "{ not json }"])("answers null after two unreadable answers: %s", async (text) => {
        const { writer, ai } = await build()
        ai.chat.mockResolvedValue(answerOf({ parsed: null, text }))

        await expect(writer.write(brief)).resolves.toBeNull()
        expect(ai.chat).toHaveBeenCalledTimes(2)
    })
})
