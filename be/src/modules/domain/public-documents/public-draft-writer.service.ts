import { Injectable } from "@nestjs/common"
import { UsageMeterService } from "@modules/domain/knowledge"
import { InjectAi, type AiService } from "@modules/integrations/ai"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { parseJsonText } from "@modules/platform/primitives"
import { DRAFT_SYSTEM_PROMPT, draftPrompt } from "./draft-prompt.policy"
import { DRAFT_SCHEMA } from "./draft.schema"
import type { PublicDraftBrief, MaybeDraftText } from "./public-documents.contracts"
import { PublicDocumentsLogEvent } from "./public-documents.log-events"

/** How long the model may take to write one text. */
const DRAFT_TIMEOUT_MS = 90_000

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
 * Writes the text for customers from the internal text left after the hard exclusions. JSON mode with a bounded schema, usage recorded
 * under the kind `brain` and the module `public_documents`, one retry when the answer does not fit, null when the model is unavailable.
 */
export class PublicDraftWriterService {
    constructor(
        @InjectAi() private readonly ai: AiService,
        private readonly usage: UsageMeterService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** The text for customers, or null when the model is unavailable or twice gave an answer that does not fit. */
    write(brief: PublicDraftBrief): Promise<MaybeDraftText> {
        return this.attempt(brief, 1)
    }

    private async attempt(brief: PublicDraftBrief, number: number): Promise<MaybeDraftText> {
        const user = draftPrompt(brief)
        const answer = await this.ai.chat({
            messages: [
                { role: "system", content: DRAFT_SYSTEM_PROMPT },
                { role: "user", content: user },
            ],
            json: true,
            schema: DRAFT_SCHEMA,
            timeoutMs: DRAFT_TIMEOUT_MS,
            context: null,
        })
        if (answer === null) return null
        await this.usage.record({
            workspaceId: brief.workspaceId,
            kind: "brain",
            module: "public_documents",
            model: answer.model,
            usage: answer.usage,
            promptChars: DRAFT_SYSTEM_PROMPT.length + user.length,
            completionChars: answer.text.length,
        })
        const structured = DRAFT_SCHEMA.safeParse(answer.parsed)
        const parsed = structured.success ? structured : DRAFT_SCHEMA.safeParse(objectIn(answer.text))
        if (parsed.success) return { body: parsed.data.body.trim() }
        this.logger.warn(PublicDocumentsLogEvent.AnswerUnreadable, { attempt: number })
        return number < 2 ? this.attempt(brief, number + 1) : null
    }
}
