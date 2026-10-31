import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { RemedyRequest } from "@modules/domain/dossier-review"
import { UsageMeterService } from "@modules/domain/knowledge"
import { AI } from "@modules/integrations/ai"
import type { AiChatAnswer, AiService } from "@modules/integrations/ai"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DossierReviewAiLogEvent } from "./dossier-review-ai.log-events"
import { REMEDY_SYSTEM_PROMPT, remedyPrompt } from "./remedy-prompt.policy"
import { RemedyWriterService } from "./remedy-writer.service"
import { REMEDY_SCHEMA } from "./remedy.schema"

const WS = "11111111-1111-4111-8111-111111111111"

const requestOf = builder<RemedyRequest>({
    workspaceId: WS,
    today: "2026-10-31",
    finding: {
        kind: "outdated",
        severity: "high",
        title: "Dieu le chua cap nhat",
        detail: "Dieu le lap khi thanh lap.",
        evidence: [{ label: "Dieu le", quote: "Von dieu le la 300.000.000 dong" }],
    },
    dossier: { ref: "2", name: "Dieu le cong ty", category: "Ho so phap ly" },
    remedy: { documentType: "Nghi quyet HDTV", guidance: null },
    identity: ["Ten cong ty: Cong ty TNHH Mau"],
    instructions: null,
})

const DRAFT = {
    title: "Nghi quyet thong qua Dieu le sua doi",
    documentType: "Nghi quyet HDTV",
    body: "# Nghi quyet\n\nNgay [Signing date: dd/mm/yyyy]",
    placeholders: [{ label: "Ngay ky", reason: "Chua co ngay hop" }],
}

const answerOf = builder<AiChatAnswer>({
    text: JSON.stringify(DRAFT),
    parsed: DRAFT,
    model: "m1",
    usage: { promptTokens: 700, completionTokens: 900, totalTokens: 1600, costUsd: null },
    retrieved: 0,
})

const build = async () => {
    const ai = mock<AiService>()
    const usage = mock<UsageMeterService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            RemedyWriterService,
            { provide: AI, useValue: ai },
            { provide: UsageMeterService, useValue: usage },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { writer: moduleRef.get(RemedyWriterService), ai, usage, logger }
}

describe("RemedyWriterService", () => {
    describe("draft", () => {
        it("asks the model once in JSON mode with the remedy prompt, the schema and a 90 s timeout", async () => {
            const { writer, ai } = await build()
            ai.chat.mockResolvedValue(answerOf())
            await writer.draft(requestOf())
            expect(ai.chat).toHaveBeenCalledTimes(1)
            expect(ai.chat).toHaveBeenCalledWith({
                messages: [
                    { role: "system", content: REMEDY_SYSTEM_PROMPT },
                    { role: "user", content: remedyPrompt(requestOf()) },
                ],
                json: true,
                schema: REMEDY_SCHEMA,
                timeoutMs: 90_000,
                context: null,
            })
        })

        it("answers the draft with the model that wrote it and no fixed tail", async () => {
            const { writer, ai } = await build()
            ai.chat.mockResolvedValue(answerOf())
            await expect(writer.draft(requestOf())).resolves.toEqual({ ...DRAFT, model: "m1" })
        })

        it("records the usage once under the kind brain and the module dossier_review with the exact numbers", async () => {
            const { writer, ai, usage } = await build()
            ai.chat.mockResolvedValue(answerOf())
            await writer.draft(requestOf())
            expect(usage.record).toHaveBeenCalledTimes(1)
            expect(usage.record).toHaveBeenCalledWith({
                workspaceId: WS,
                kind: "brain",
                module: "dossier_review",
                model: "m1",
                usage: { promptTokens: 700, completionTokens: 900, totalTokens: 1600, costUsd: null },
                promptChars: REMEDY_SYSTEM_PROMPT.length + remedyPrompt(requestOf()).length,
                completionChars: JSON.stringify(DRAFT).length,
            })
        })

        it("answers null without a retry when the model is unavailable", async () => {
            const { writer, ai } = await build()
            ai.chat.mockResolvedValue(null)
            await expect(writer.draft(requestOf())).resolves.toBeNull()
            expect(ai.chat).toHaveBeenCalledTimes(1)
        })

        it("asks again once when the first answer has an empty body and uses the second", async () => {
            const { writer, ai, usage } = await build()
            ai.chat
                .mockResolvedValueOnce(answerOf({ parsed: { ...DRAFT, body: "" }, text: "{}" }))
                .mockResolvedValueOnce(answerOf())
            await expect(writer.draft(requestOf())).resolves.toEqual({ ...DRAFT, model: "m1" })
            expect(usage.record).toHaveBeenCalledTimes(2)
        })

        it("answers null after two unreadable answers", async () => {
            const { writer, ai, logger } = await build()
            ai.chat.mockResolvedValue(answerOf({ parsed: null, text: "no json" }))
            await expect(writer.draft(requestOf())).resolves.toBeNull()
            expect(ai.chat).toHaveBeenCalledTimes(2)
            expect(logger.warn).toHaveBeenLastCalledWith(DossierReviewAiLogEvent.AnswerGivenUp, { purpose: "remedy" })
        })

        it("answers null when the answer is valid JSON but the title is only whitespace", async () => {
            const { writer, ai } = await build()
            ai.chat.mockResolvedValue(answerOf({ parsed: { ...DRAFT, title: "   " } }))
            await expect(writer.draft(requestOf())).resolves.toBeNull()
            expect(ai.chat).toHaveBeenCalledTimes(1)
        })
    })
})
