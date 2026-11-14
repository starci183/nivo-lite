import { Injectable } from "@nestjs/common"
import { UsageMeterService } from "@modules/domain/knowledge"
import { InjectAi, spendOf, type AiService } from "@modules/integrations/ai"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { parseJsonText } from "@modules/platform/primitives"
import { DRAFT_SYSTEM_PROMPT, PUBLIC_DRAFT_PROMPT_VERSION, draftPrompt } from "./draft-prompt.policy"
import { DRAFT_OUTPUT_SCHEMA } from "./draft-answer.policy"
import { DRAFT_READ_SCHEMA, type DraftAnswer } from "./draft.schema"
import type { PublicDraftBrief } from "./public-documents.contracts"
import { PublicDocumentsLogEvent } from "./public-documents.log-events"

/** How long the model may take to read the documents and write one text. */
const DRAFT_TIMEOUT_MS = 90_000

/** The most calls one draft makes: the first and one retry after an unreadable answer. */
export const MAX_DRAFT_TRIES = 2

/** The fence a model may wrap its JSON in. */
const FENCE = /`{3}(?:json)?/giu

/** The first JSON object found in a text a model wrapped in prose or a fence, or null. */
const objectIn = (text: string): unknown => {
    const body = text.replaceAll(FENCE, "")
    const from = body.indexOf("{")
    const to = body.lastIndexOf("}")
    if (from < 0 || to <= from) return null
    const read = parseJsonText(body.slice(from, to + 1))
    return read.ok ? read.value : null
}

@Injectable()
/**
 * Asks the model, in ONE call, to write the text for customers from public-area documents, and whether the documents answer what is
 * asked at all. JSON mode with the API's structured output where the route has it, usage recorded under the kind `brain` and the
 * module `public_documents`, one retry when the answer does not fit, null when the model is unavailable, cut, or twice unreadable.
 */
export class PublicDraftWriterService {
    constructor(
        @InjectAi() private readonly ai: AiService,
        private readonly usage: UsageMeterService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** The model's answer, or null (nothing of the sources is then written anywhere). */
    write(brief: PublicDraftBrief): Promise<DraftAnswer | null> {
        return this.attempt(brief, 1)
    }

    /**
     * One call. The credit pool is checked before every call: the first by the run right before it (`PublicDraftRunService.generate`),
     * the retry here (null when the pool is empty). A try that returned tokens is booked with what it spent, a cut one included.
     */
    private async attempt(brief: PublicDraftBrief, number: number): Promise<DraftAnswer | null> {
        if (number > 1 && (await this.usage.blockedBy(brief.workspaceId, "brain", false))) return null
        const user = draftPrompt(brief)
        const tried = await this.ai.attempt({
            messages: [
                { role: "system", content: DRAFT_SYSTEM_PROMPT },
                { role: "user", content: user },
            ],
            json: true,
            schema: DRAFT_READ_SCHEMA,
            outputSchema: DRAFT_OUTPUT_SCHEMA,
            timeoutMs: DRAFT_TIMEOUT_MS,
            context: null,
        })
        const spend = spendOf(tried)
        if (spend !== null) {
            await this.usage.record({
                workspaceId: brief.workspaceId,
                kind: "brain",
                module: "public_documents",
                promptChars: DRAFT_SYSTEM_PROMPT.length + user.length,
                tryNumber: number,
                ...spend,
            })
        }
        if (!tried.ok) return null
        const answer = tried.answer
        const structured = DRAFT_READ_SCHEMA.safeParse(answer.parsed)
        const parsed = structured.success ? structured : DRAFT_READ_SCHEMA.safeParse(objectIn(answer.text))
        if (parsed.success) {
            this.logger.info(PublicDocumentsLogEvent.DraftRead, {
                promptVersion: PUBLIC_DRAFT_PROMPT_VERSION,
                attempt: number,
                answers: parsed.data.answers,
                bodyChars: parsed.data.body.length,
            })
            return parsed.data
        }
        this.logger.warn(PublicDocumentsLogEvent.AnswerUnreadable, { attempt: number, promptVersion: PUBLIC_DRAFT_PROMPT_VERSION })
        return number < MAX_DRAFT_TRIES ? this.attempt(brief, number + 1) : null
    }
}
