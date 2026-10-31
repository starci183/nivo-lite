import type { UsageMeterService } from "@modules/domain/knowledge"
import type { AiChatAnswer, AiService } from "@modules/integrations/ai"
import type { Logger } from "@modules/platform/logging"
import type { OptionalCallResult } from "./dossier-review-ai.contracts"
import { DossierReviewAiLogEvent } from "./dossier-review-ai.log-events"
import type { AnswerSchema } from "./dossier-review.schema"

/** One structured model call. */
export interface ModelCallParams<T> {
    /** The workspace that pays for the call. */
    readonly workspaceId: string
    /** The standing instructions. */
    readonly system: string
    /** The user message. */
    readonly user: string
    /** The shape the answer must fit. */
    readonly schema: AnswerSchema<T>
    /** The whole call in milliseconds. */
    readonly timeoutMs: number
    /** What the call is for, for the log. */
    readonly purpose: string
}

/** What one call of the model made: the model, the tokens, and the answer when it fit the schema. */
interface Attempt<T> {
    readonly value: T | null
    readonly model: string
    readonly promptTokens: number | null
    readonly completionTokens: number | null
}

/** The fence a model may wrap its JSON in. */
const FENCE = new RegExp("`{3}(?:json)?", "gi")

/** The sum of two token counts where null means not reported. */
const sumOf = (left: number | null, right: number | null): number | null =>
    left === null && right === null ? null : (left ?? 0) + (right ?? 0)

/**
 * The call both dossier-review services make: JSON mode with a bounded schema, usage recorded for every answer received under the kind
 * `brain` and the module `dossier_review`, one retry when the answer does not parse, and null when the model is unavailable or the retry
 * fails. It holds no state of its own: the services extend it and inject the three collaborators, so the registering module needs nothing else.
 */
export abstract class ModelCallPolicy {
    protected constructor(
        private readonly ai: AiService,
        private readonly usage: UsageMeterService,
        private readonly logger: Logger,
    ) {}

    /** Asks the model; an unavailable model answers null at once, an unreadable answer is asked again once. */
    protected async ask<T>(params: ModelCallParams<T>): Promise<OptionalCallResult<T>> {
        const first = await this.attempt(params, 1)
        if (first === null) return null
        if (first.value !== null) return { ...first, value: first.value }
        const second = await this.attempt(params, 2)
        if (second === null) return null
        if (second.value === null) {
            this.logger.warn(DossierReviewAiLogEvent.AnswerGivenUp, { purpose: params.purpose })
            return null
        }
        return {
            value: second.value,
            model: second.model,
            promptTokens: sumOf(first.promptTokens, second.promptTokens),
            completionTokens: sumOf(first.completionTokens, second.completionTokens),
        }
    }

    /** One call of the model with its usage recorded; null when the model is unavailable. */
    private async attempt<T>(params: ModelCallParams<T>, attempt: number): Promise<Attempt<T> | null> {
        const answer = await this.ai.chat({
            messages: [
                { role: "system", content: params.system },
                { role: "user", content: params.user },
            ],
            json: true,
            schema: params.schema,
            timeoutMs: params.timeoutMs,
            context: null,
        })
        if (answer === null) return null
        await this.usage.record({
            workspaceId: params.workspaceId,
            kind: "brain",
            module: "dossier_review",
            model: answer.model,
            usage: answer.usage,
            promptChars: params.system.length + params.user.length,
            completionChars: answer.text.length,
        })
        const parsed = this.read(params.schema, answer)
        if (!parsed.success) {
            this.logger.warn(DossierReviewAiLogEvent.AnswerUnreadable, { purpose: params.purpose, attempt })
        }
        return {
            value: parsed.success ? parsed.data : null,
            model: answer.model,
            promptTokens: answer.usage.promptTokens,
            completionTokens: answer.usage.completionTokens,
        }
    }

    /** The answer as the schema reads it: the structured output first, else the JSON found in the text. */
    private read<T>(schema: AnswerSchema<T>, answer: AiChatAnswer): ReturnType<AnswerSchema<T>["safeParse"]> {
        const structured = schema.safeParse(answer.parsed)
        return structured.success ? structured : schema.safeParse(this.jsonOf(answer.text))
    }

    /** The first object found in a text a model wrapped in prose or a markdown fence, or null when none parses. */
    private jsonOf(text: string): unknown {
        const body = text.replace(FENCE, "")
        const from = body.indexOf("{")
        const to = body.lastIndexOf("}")
        if (from < 0 || to <= from) return null
        try {
            return JSON.parse(body.slice(from, to + 1))
        } catch (cause) {
            this.logger.error(DossierReviewAiLogEvent.JsonUnreadable, cause)
            return null
        }
    }
}
