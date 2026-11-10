import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { CritiqueBundle } from "@modules/domain/dossier-review"
import { UsageMeterService } from "@modules/domain/knowledge"
import { AI } from "@modules/integrations/ai"
import type { AiChatAnswer, AiService } from "@modules/integrations/ai"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CRITIC_SYSTEM_PROMPT, criticUserPrompt } from "./document-critic-prompt.policy"
import { DossierReasonerService } from "./dossier-reasoner.service"

const WS = "11111111-1111-4111-8111-111111111111"

const bundleOf = builder<CritiqueBundle>({
    workspaceId: WS,
    today: "2026-11-11",
    title: "Quy dinh Tiem hoa NIVO",
    firstUpload: false,
    changed: [{ key: "P1", text: "## Giao nhanh\n\nGiao nhanh trong 2 gio (noi thanh): phu thu 20.000 d moi don." }],
    context: [{ key: "C1", text: "## Thanh toan\n\n- Khong nhan tien mat khi giao." }],
    facts: [{ key: "F1", text: "Giao nhanh - Phu thu: 20.000 d" }],
    shop: [],
    known: [],
})

const ANSWER = {
    findings: [
        {
            kind: "vague",
            severity: "medium",
            line: "Giao nhanh: ngoai thanh thi sao?",
            why: "Chi noi noi thanh.",
            question: "Giao nhanh ngoai thanh co khong, phu thu bao nhieu?",
            quotes: [{ key: "P1", quote: "Giao nhanh trong 2 gio (noi thanh)" }],
            values: [],
        },
    ],
}

const answerOf = builder<AiChatAnswer>({
    text: JSON.stringify(ANSWER),
    parsed: ANSWER,
    model: "m1",
    usage: { promptTokens: 900, completionTokens: 120, totalTokens: 1020, costUsd: 0.001 },
    retrieved: 0,
})

const build = async () => {
    const ai = mock<AiService>()
    const usage = mock<UsageMeterService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DossierReasonerService,
            { provide: AI, useValue: ai },
            { provide: UsageMeterService, useValue: usage },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return { critic: moduleRef.get(DossierReasonerService), ai, usage }
}

describe("DossierReasonerService critique (the shop-document critic's model, scripted)", () => {
    it("makes exactly ONE call per try: JSON mode, the critic prompt (challenge, never rewrite), the changed passages only, no reasoning, metered as brain", async () => {
        const { critic, ai, usage } = await build()
        ai.chat.mockResolvedValue(answerOf())
        await expect(critic.critique(bundleOf())).resolves.toEqual({
            ok: true,
            answer: { findings: ANSWER.findings, model: "m1", promptTokens: 900, completionTokens: 120 },
        })
        expect(ai.chat).toHaveBeenCalledTimes(1)
        const [call] = ai.chat.mock.calls[0] ?? []
        expect(call).toEqual(
            expect.objectContaining({
                json: true,
                timeoutMs: 60_000,
                budget: { effort: "off", maxTokens: 4000 },
                messages: [
                    { role: "system", content: CRITIC_SYSTEM_PROMPT },
                    { role: "user", content: criticUserPrompt(bundleOf()) },
                ],
            }),
        )
        expect(CRITIC_SYSTEM_PROMPT).toContain("you never change a value, you ask the owner a question")
        expect(criticUserPrompt(bundleOf())).toContain("later upload: check ONLY the changed passages P")
        expect(usage.record).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: WS, kind: "brain", module: "dossier_review", model: "m1" }))
    })

    it("an unreadable answer is ONE recorded call reported as unreadable (no hidden retry); no answer at all is unavailable", async () => {
        const { critic, ai, usage } = await build()
        ai.chat.mockResolvedValueOnce(answerOf({ text: "not json", parsed: null }))
        await expect(critic.critique(bundleOf())).resolves.toEqual({ ok: false, reason: "unreadable" })
        expect(ai.chat).toHaveBeenCalledTimes(1)
        expect(usage.record).toHaveBeenCalledTimes(1)
        ai.chat.mockResolvedValueOnce(null)
        await expect(critic.critique(bundleOf())).resolves.toEqual({ ok: false, reason: "unavailable" })
    })
})
