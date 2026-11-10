import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AI } from "@modules/integrations/ai"
import type { AiChatAttempt, AiService } from "@modules/integrations/ai"
import type { PageImage } from "@modules/integrations/document-readers"
import { DocumentTranscriptionService } from "./document-transcription.service"
import { NOTHING_WRITTEN, TRANSCRIPTION_PROMPT, transcriptOf } from "./transcription.policy"
import { UsageMeterService } from "./usage-meter.service"

const WS = "11111111-1111-4111-8111-111111111111"

const IMAGE: PageImage = { bytes: new Uint8Array([0xff, 0xd8, 0xff]), mime: "image/jpeg", label: "2" }

const USAGE = { promptTokens: 900, completionTokens: 40, totalTokens: 940, costUsd: 0.001 }

const answered = (text: string): AiChatAttempt => ({
    ok: true,
    answer: { text, parsed: null, model: "vision-model", usage: USAGE, retrieved: 0 },
})

const build = async () => {
    const ai = mock<AiService>()
    const usage = mock<UsageMeterService>()
    ai.available.mockReturnValue(true)
    usage.blockedBy.mockResolvedValue(false)
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentTranscriptionService,
            { provide: AI, useValue: ai },
            { provide: UsageMeterService, useValue: usage },
        ],
    }).compile()
    const transcriber = moduleRef.get(DocumentTranscriptionService).transcriberFor(WS)
    return { transcriber, ai, usage }
}

describe("DocumentTranscriptionService", () => {
    it("sends ONE call with the picture as a data address and the do-not-infer instructions, and meters it as brain work", async () => {
        const { transcriber, ai, usage } = await build()
        ai.attempt.mockResolvedValue(answered("BẢNG GIÁ\nHồng | 35.000"))

        await expect(transcriber.transcribe(IMAGE)).resolves.toEqual({ kind: "ok", value: "BẢNG GIÁ\nHồng | 35.000" })

        expect(ai.attempt).toHaveBeenCalledTimes(1)
        const [request] = ai.attempt.mock.calls[0] ?? []
        expect(request).toMatchObject({
            messages: [
                { role: "system", content: TRANSCRIPTION_PROMPT },
                { role: "user", content: "Page 2. Transcribe it.", images: ["data:image/jpeg;base64,/9j/"] },
            ],
            json: false,
            context: null,
            budget: { effort: "off", maxTokens: 4000 },
            affinity: WS,
        })
        expect(TRANSCRIPTION_PROMPT).toContain("Transcribe what is written, do not infer")
        expect(usage.blockedBy).toHaveBeenCalledWith(WS, "brain", false)
        expect(usage.record).toHaveBeenCalledWith({
            workspaceId: WS,
            kind: "brain",
            module: "knowledge",
            model: "vision-model",
            usage: USAGE,
            promptChars: TRANSCRIPTION_PROMPT.length + "Page 2. Transcribe it.".length,
            completionChars: "BẢNG GIÁ\nHồng | 35.000".length,
            tryNumber: 1,
        })
    })

    it("answers an empty text for a picture with nothing written on it", async () => {
        const { transcriber, ai } = await build()
        ai.attempt.mockResolvedValue(answered(NOTHING_WRITTEN))

        await expect(transcriber.transcribe(IMAGE)).resolves.toEqual({ kind: "ok", value: "" })
    })

    it("tries three times in all, then refuses as failed; every try is metered, a failed one estimated (never billed)", async () => {
        const { transcriber, ai, usage } = await build()
        ai.attempt.mockResolvedValue({ ok: false, failure: "timeout" })
        await expect(transcriber.transcribe(IMAGE)).resolves.toMatchObject({ kind: "refused", code: "failed" })
        expect(ai.attempt).toHaveBeenCalledTimes(3)
        expect(
            usage.record.mock.calls.map(([entry]) => [
                entry.failure,
                entry.tryNumber,
                entry.usage,
                entry.completionChars,
            ]),
        ).toEqual([
            ["timeout", 1, null, 0],
            ["timeout", 2, null, 0],
            ["timeout", 3, null, 0],
        ])

        ai.attempt.mockReset()
        usage.record.mockClear()
        ai.attempt.mockResolvedValueOnce({ ok: false, failure: "provider" }).mockResolvedValueOnce(answered("Hoa ly"))
        await expect(transcriber.transcribe(IMAGE)).resolves.toEqual({ kind: "ok", value: "Hoa ly" })
        expect(usage.record.mock.calls.map(([entry]) => [entry.failure, entry.tryNumber])).toEqual([
            ["provider", 1],
            [undefined, 2],
        ])
    })

    it("makes no call when the AI is off, the endpoint is unconfigured or the allowance is used up", async () => {
        const off = await build()
        off.ai.available.mockReturnValue(false)
        await expect(off.transcriber.transcribe(IMAGE)).resolves.toMatchObject({ code: "unavailable" })
        expect(off.ai.attempt).not.toHaveBeenCalled()

        const unconfigured = await build()
        unconfigured.ai.attempt.mockResolvedValue({ ok: false, failure: "unconfigured" })
        await expect(unconfigured.transcriber.transcribe(IMAGE)).resolves.toMatchObject({ code: "unavailable" })
        expect(unconfigured.ai.attempt).toHaveBeenCalledTimes(1)

        const broke = await build()
        broke.usage.blockedBy.mockResolvedValue(true)
        await expect(broke.transcriber.transcribe(IMAGE)).resolves.toMatchObject({ code: "no_credits" })
        expect(broke.ai.attempt).not.toHaveBeenCalled()
    })

    it("drops code fences around an answer", () => {
        expect(transcriptOf("```text\nHồng | 35.000\n```")).toBe("Hồng | 35.000")
        expect(transcriptOf("  ")).toBe("")
    })
})
