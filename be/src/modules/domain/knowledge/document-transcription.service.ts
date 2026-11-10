import { Injectable } from "@nestjs/common"
import { InjectAi } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
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

    /** One try of the call and, while it failed and tries remain, the next; every try is metered (a failed one estimated). */
    private async tried(
        workspaceId: string,
        request: ChatRequest,
        promptChars: number,
        attempt: number,
    ): Promise<TranscriptOutcome> {
        const answer = await this.ai.attempt(request)
        if (answer.ok) {
            await this.usage.record({
                workspaceId,
                kind: "brain",
                module: "knowledge",
                model: answer.answer.model,
                usage: answer.answer.usage,
                promptChars,
                completionChars: answer.answer.text.length,
                tryNumber: attempt,
            })
            return ok(transcriptOf(answer.answer.text))
        }
        if (answer.failure === "unconfigured") return refused("unavailable")
        // A failed try may still be charged by the provider: booked estimated from the prompt's text (the picture is not counted),
        // never billed (U1). The model it asked for is the endpoint's chat profile.
        await this.usage.record({
            workspaceId,
            kind: "brain",
            module: "knowledge",
            model: TRANSCRIPTION_MODEL,
            usage: null,
            promptChars,
            completionChars: 0,
            failure: answer.failure,
            tryNumber: attempt,
        })
        return attempt >= TRANSCRIPTION_TRIES
            ? refused("failed")
            : this.tried(workspaceId, request, promptChars, attempt + 1)
    }
}
