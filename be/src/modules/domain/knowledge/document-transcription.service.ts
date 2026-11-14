import { Injectable } from "@nestjs/common"
import { InjectAi, spendOf, type AiService } from "@modules/integrations/ai"
import type { PageImage, TranscriptOutcome, Transcriber } from "@modules/integrations/document-readers"
import { ok, refused } from "@modules/platform/primitives"
import {
    TRANSCRIPTION_MAX_TOKENS,
    TRANSCRIPTION_PROMPT,
    TRANSCRIPTION_TIMEOUT_MS,
    TRANSCRIPTION_TRIES,
    transcriptOf,
    transcriptionAsk,
} from "./transcription.policy"
import { UsageMeterService } from "./usage-meter.service"

/** One chat call of the AI layer. */
type ChatRequest = Parameters<AiService["attempt"]>[0]

/** The model a failed try is booked with: the endpoint's chat profile served it, its model was never told. */
const TRANSCRIPTION_MODEL = "work"

@Injectable()
/**
 * The model door of the document readers: ONE call per picture of a page, through the AI layer's picture path (the picture travels as a
 * data address), "transcribe what is written, do not infer". Each call is checked against the workspace's AI allowance before it is made
 * and metered as brain work of the knowledge module once it answered; it gets three tries in all, like any AI call.
 */
export class DocumentTranscriptionService {
    constructor(
        @InjectAi() private readonly ai: AiService,
        private readonly usage: UsageMeterService,
    ) {}

    /** The transcriber of the documents of one workspace, which pays for its calls. */
    transcriberFor(workspaceId: string): Transcriber {
        return { transcribe: (image) => this.transcribe(workspaceId, image) }
    }

    /** The text written on one picture: empty when nothing is written; refused when the AI is off, the allowance is used up, or every try failed. */
    private async transcribe(workspaceId: string, image: PageImage): Promise<TranscriptOutcome> {
        if (!this.ai.available()) return refused("unavailable")
        if (await this.usage.blockedBy(workspaceId, "brain", false)) return refused("no_credits")
        const ask = transcriptionAsk(image.label)
        const request: ChatRequest = {
            messages: [
                { role: "system", content: TRANSCRIPTION_PROMPT },
                {
                    role: "user",
                    content: ask,
                    images: [`data:${image.mime};base64,${Buffer.from(image.bytes).toString("base64")}`],
                },
            ],
            json: false,
            schema: null,
            timeoutMs: TRANSCRIPTION_TIMEOUT_MS,
            budget: { effort: "off", maxTokens: TRANSCRIPTION_MAX_TOKENS },
            context: null,
            affinity: workspaceId,
        }
        return this.tried(workspaceId, request, TRANSCRIPTION_PROMPT.length + ask.length, 1)
    }

    /**
     * One try of the call and, while it failed and tries remain, the next. The credit pool is checked before EVERY try (owner: the pool
     * is the only limit); a try that returned tokens is booked with what it spent, a cut or empty one included (`spendOf`), and a try
     * that returned nothing is booked estimated, never billed (U1): each try exactly once.
     */
    private async tried(
        workspaceId: string,
        request: ChatRequest,
        promptChars: number,
        attempt: number,
    ): Promise<TranscriptOutcome> {
        if (attempt > 1 && (await this.usage.blockedBy(workspaceId, "brain", false))) return refused("no_credits")
        const answer = await this.ai.attempt(request)
        if (!answer.ok && answer.failure === "unconfigured") return refused("unavailable")
        const booked = { workspaceId, kind: "brain" as const, module: "knowledge", promptChars, tryNumber: attempt }
        const spend = spendOf(answer)
        // A try that returned nothing may still be charged by the provider: booked estimated from the prompt's text (the picture is
        // not counted), never billed (U1). The model it asked for is the endpoint's chat profile.
        await this.usage.record(
            spend !== null
                ? { ...booked, ...spend }
                : {
                      ...booked,
                      model: TRANSCRIPTION_MODEL,
                      usage: null,
                      completionChars: 0,
                      failure: answer.ok ? undefined : answer.failure,
                  },
        )
        if (answer.ok) return ok(transcriptOf(answer.answer.text))
        return attempt >= TRANSCRIPTION_TRIES
            ? refused("failed")
            : this.tried(workspaceId, request, promptChars, attempt + 1)
    }
}
