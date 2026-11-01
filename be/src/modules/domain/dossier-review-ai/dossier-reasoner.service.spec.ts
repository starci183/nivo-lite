import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { DossierBundle } from "@modules/domain/dossier-review"
import { UsageMeterService } from "@modules/domain/knowledge"
import { AI } from "@modules/integrations/ai"
import type { AiChatAnswer, AiService } from "@modules/integrations/ai"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DossierReasonerService } from "./dossier-reasoner.service"
import { DossierReviewAiLogEvent } from "./dossier-review-ai.log-events"
import { SYSTEM_PROMPT, userPrompt } from "./dossier-review-prompt.policy"
import { DOSSIER_REVIEW_SCHEMA } from "./dossier-review.schema"

const WS = "11111111-1111-4111-8111-111111111111"

const bundleOf = builder<DossierBundle>({
    workspaceId: WS,
    today: "2026-10-31",
    packVersion: "vn-llc-64@1",
    dossier: { ref: "2", name: "Dieu le cong ty", category: "Ho so phap ly", requirement: "required", basis: [] },
    checklist: null,
    related: [],
    documents: [
        {
            key: "S1",
            title: "2. Dieu le",
            state: "actual",
            date: "2026-01-06",
            passages: [{ key: "S1.P1", text: "Von dieu le la 300.000.000 dong." }],
        },
    ],
    facts: [{ key: "F1", text: "Cong ty · von dieu le = 285.000.000 VND (proposed) — S1" }],
    known: [],
    openAi: [],
})

const FINDING = {
    kind: "contradiction",
    severity: "high",
    title: "Von dieu le khong khop",
    detail: "Dieu le ghi 300 trieu, sao ke ghi 285 trieu.",
    evidence: [
        { key: "S1.P1", quote: "Von dieu le la 300.000.000 dong" },
        { key: "F1", quote: "285.000.000 VND" },
    ],
    relatedRefs: [],
    remedyAction: "decide",
    documentType: null,
}
const ANSWER = { findings: [FINDING], stillOpen: [] }

const answerOf = builder<AiChatAnswer>({
    text: JSON.stringify(ANSWER),
    parsed: ANSWER,
    model: "m1",
    usage: { promptTokens: 1000, completionTokens: 200, totalTokens: 1200, costUsd: 0.01 },
    retrieved: 0,
})

const build = async () => {
    const ai = mock<AiService>()
    const usage = mock<UsageMeterService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DossierReasonerService,
            { provide: AI, useValue: ai },
            { provide: UsageMeterService, useValue: usage },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { reasoner: moduleRef.get(DossierReasonerService), ai, usage, logger }
}

describe("DossierReasonerService review call", () => {
    it("asks the model once in JSON mode with the system prompt, the bundle text, the schema and a 60 s timeout and a no-reasoning budget", async () => {
        const { reasoner, ai } = await build()
        ai.chat.mockResolvedValue(answerOf())
        await reasoner.review(bundleOf())
        expect(ai.chat).toHaveBeenCalledTimes(1)
        expect(ai.chat).toHaveBeenCalledWith({
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userPrompt(bundleOf()) },
            ],
            json: true,
            schema: DOSSIER_REVIEW_SCHEMA,
            timeoutMs: 60_000,
            budget: { effort: "off", maxTokens: 8000 },
            context: null,
        })
    })

    it("answers the findings with the model and the exact tokens of the call", async () => {
        const { reasoner, ai } = await build()
        ai.chat.mockResolvedValue(answerOf())
        await expect(reasoner.review(bundleOf())).resolves.toEqual({
            findings: [FINDING],
            stillOpen: [],
            model: "m1",
            promptTokens: 1000,
            completionTokens: 200,
        })
    })

    it("records the usage once under the kind brain and the module dossier_review with the exact numbers", async () => {
        const { reasoner, ai, usage } = await build()
        ai.chat.mockResolvedValue(answerOf())
        await reasoner.review(bundleOf())
        expect(usage.record).toHaveBeenCalledTimes(1)
        expect(usage.record).toHaveBeenCalledWith({
            workspaceId: WS,
            kind: "brain",
            module: "dossier_review",
            model: "m1",
            usage: { promptTokens: 1000, completionTokens: 200, totalTokens: 1200, costUsd: 0.01 },
            promptChars: SYSTEM_PROMPT.length + userPrompt(bundleOf()).length,
            completionChars: JSON.stringify(ANSWER).length,
        })
    })

    it("reads the JSON out of the text when the structured output is missing", async () => {
        const { reasoner, ai } = await build()
        ai.chat.mockResolvedValue(
            answerOf({ parsed: null, text: `Ket qua:\n\`\`\`json\n${JSON.stringify(ANSWER)}\n\`\`\`` }),
        )
        const review = await reasoner.review(bundleOf())
        expect(review?.findings).toEqual([FINDING])
        expect(ai.chat).toHaveBeenCalledTimes(1)
    })
})

describe("DossierReasonerService review unavailable and retry", () => {
    it("answers null at once, without a retry or usage, when the model is unavailable", async () => {
        const { reasoner, ai, usage } = await build()
        ai.chat.mockResolvedValue(null)
        await expect(reasoner.review(bundleOf())).resolves.toBeNull()
        expect(ai.chat).toHaveBeenCalledTimes(1)
        expect(usage.record).not.toHaveBeenCalled()
    })

    it("asks again once when the first answer does not parse, records both calls and sums their tokens", async () => {
        const { reasoner, ai, usage, logger } = await build()
        ai.chat.mockResolvedValueOnce(answerOf({ parsed: null, text: "not json", model: "m1" })).mockResolvedValueOnce(
            answerOf({
                model: "m2",
                usage: { promptTokens: 1000, completionTokens: 300, totalTokens: 1300, costUsd: null },
            }),
        )
        const review = await reasoner.review(bundleOf())
        expect(review).toEqual({
            findings: [FINDING],
            stillOpen: [],
            model: "m2",
            promptTokens: 2000,
            completionTokens: 500,
        })
        expect(ai.chat).toHaveBeenCalledTimes(2)
        expect(usage.record).toHaveBeenCalledTimes(2)
        expect(logger.warn).toHaveBeenCalledWith(DossierReviewAiLogEvent.AnswerUnreadable, {
            purpose: "review",
            attempt: 1,
        })
    })

    it("answers null after two answers that do not parse and logs that it gave up", async () => {
        const { reasoner, ai, usage, logger } = await build()
        ai.chat.mockResolvedValue(answerOf({ parsed: { findings: "no" }, text: "still not json" }))
        await expect(reasoner.review(bundleOf())).resolves.toBeNull()
        expect(ai.chat).toHaveBeenCalledTimes(2)
        expect(usage.record).toHaveBeenCalledTimes(2)
        expect(logger.warn).toHaveBeenLastCalledWith(DossierReviewAiLogEvent.AnswerGivenUp, { purpose: "review" })
    })

    it("answers null when the retry finds the model unavailable", async () => {
        const { reasoner, ai, usage } = await build()
        ai.chat.mockResolvedValueOnce(answerOf({ parsed: null, text: "oops" })).mockResolvedValueOnce(null)
        await expect(reasoner.review(bundleOf())).resolves.toBeNull()
        expect(usage.record).toHaveBeenCalledTimes(1)
    })
})

describe("DossierReasonerService review tokens", () => {
    it("reports tokens as null when no call reported any", async () => {
        const { reasoner, ai } = await build()
        ai.chat.mockResolvedValue(
            answerOf({ usage: { promptTokens: null, completionTokens: null, totalTokens: null, costUsd: null } }),
        )
        const review = await reasoner.review(bundleOf())
        expect(review?.promptTokens).toBeNull()
        expect(review?.completionTokens).toBeNull()
    })

    it("sums the tokens that were reported when only one call reported them", async () => {
        const { reasoner, ai } = await build()
        ai.chat
            .mockResolvedValueOnce(
                answerOf({
                    parsed: null,
                    text: "oops",
                    usage: { promptTokens: 500, completionTokens: null, totalTokens: null, costUsd: null },
                }),
            )
            .mockResolvedValueOnce(
                answerOf({ usage: { promptTokens: null, completionTokens: 80, totalTokens: null, costUsd: null } }),
            )
        const review = await reasoner.review(bundleOf())
        expect(review?.promptTokens).toBe(500)
        expect(review?.completionTokens).toBe(80)
    })
})

describe("DossierReasonerService review unreadable text", () => {
    it("logs the JSON that does not parse and asks again", async () => {
        const { reasoner, ai, logger } = await build()
        ai.chat
            .mockResolvedValueOnce(answerOf({ parsed: null, text: "{broken json}" }))
            .mockResolvedValueOnce(answerOf())
        const review = await reasoner.review(bundleOf())
        expect(review?.findings).toEqual([FINDING])
        expect(logger.error).toHaveBeenCalledWith(DossierReviewAiLogEvent.JsonUnreadable, expect.any(SyntaxError))
    })

    it("treats a closing brace before an opening one as no JSON at all", async () => {
        const { reasoner, ai, logger } = await build()
        ai.chat.mockResolvedValue(answerOf({ parsed: null, text: "} then {" }))
        await expect(reasoner.review(bundleOf())).resolves.toBeNull()
        expect(logger.error).not.toHaveBeenCalled()
    })
})

describe("DossierReasonerService review late tokens", () => {
    it("sums tokens when only the second call reported them", async () => {
        const { reasoner, ai } = await build()
        const unreported = { promptTokens: null, completionTokens: null, totalTokens: null, costUsd: null }
        ai.chat
            .mockResolvedValueOnce(answerOf({ parsed: null, text: "oops", usage: unreported }))
            .mockResolvedValueOnce(answerOf())
        const review = await reasoner.review(bundleOf())
        expect(review?.promptTokens).toBe(1000)
        expect(review?.completionTokens).toBe(200)
    })
})

describe("DossierReasonerService review unreported tokens after a retry", () => {
    it("reports null tokens when neither call reported any", async () => {
        const { reasoner, ai } = await build()
        const unreported = { promptTokens: null, completionTokens: null, totalTokens: null, costUsd: null }
        ai.chat
            .mockResolvedValueOnce(answerOf({ parsed: null, text: "oops", usage: unreported }))
            .mockResolvedValueOnce(answerOf({ usage: unreported }))
        const review = await reasoner.review(bundleOf())
        expect(review?.promptTokens).toBeNull()
        expect(review?.completionTokens).toBeNull()
    })
})
