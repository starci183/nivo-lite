import type { ZodType } from "zod"
import type { UsageMeterService } from "@modules/domain/knowledge"
import { spendOf, type AiBudget, type AiChatAnswer, type AiService, type AiTarget } from "@modules/integrations/ai"
import type { Logger } from "@modules/platform/logging"
import type { ModelCallResult } from "./dossier-review-ai.contracts"
import { DossierReviewAiLogEvent } from "./dossier-review-ai.log-events"

/** The schema a model answer is read with: a bounded zod object whose parsed value is `T`. */
export type AnswerSchema<T> = ZodType<T>

/** One structured model call. */
export interface ModelCallParams<T> {
    /** The workspace that pays for the call. */
    readonly workspaceId: string
    /** The standing instructions. */
    readonly system: string
    /** The user message. */
    readonly user: string
    /**
     * A stable block of DATA the call reads before its user message (a document the calls of one piece of work share), sent as its
     * own user message. With `cached`, it carries a cache mark of its own: the calls after the first read the instructions and
     * this block from the provider's cache. Data stays out of the standing instructions.
     */
    readonly context?: string
    /** The shape the answer must fit. */
    readonly schema: AnswerSchema<T>
    /**
     * The same answer as a JSON Schema, sent as the API's structured output where the serving protocol has it
     * (`AiChatRequest.outputSchema`: every object closed, no length or number bound). The answer is still read with `schema`.
     * Absent: the answer is asked as plain JSON.
     */
    readonly outputSchema?: Readonly<Record<string, unknown>>
    /** The whole call in milliseconds. */
    readonly timeoutMs: number
    /** What the call is for, for the log. */
    readonly purpose: string
    /** What the model may spend on it: the reasoning effort and the most tokens it may write. */
    readonly budget: AiBudget
    /** The model the call asks for; absent, the endpoint's chat profile (the cheap tier). */
    readonly target?: AiTarget
    /**
     * True when the standing instructions are the stable layer of the prompt: they carry the cache mark, and the calls of one
     * workspace are routed together so each finds the cache the one before wrote (the lane's prompt-cache design).
     */
    readonly cached?: boolean
}

/** What one call of the model made: the model, the tokens, and the answer when it fit the schema. */
interface Attempt<T> {
    readonly value: T | null
    /** True when the answer was cut at the token cap (told by the finish reason): there is half an answer, nothing to parse. */
    readonly cut: boolean
    readonly model: string
    readonly promptTokens: number | null
    readonly completionTokens: number | null
}

/** The fence a model may wrap its JSON in. */
const FENCE = /`{3}(?:json)?/gi

/**
 * The call the critic model makes: JSON mode with a bounded schema and usage recorded for every answer received under the kind `brain`
 * and the module `dossier_review`. It holds no state of its own: the service extends it and injects the three collaborators, so the
 * registering module needs nothing else.
 */
export abstract class ModelCallPolicy {
    protected constructor(
        private readonly ai: AiService,
        private readonly usage: UsageMeterService,
        private readonly logger: Logger,
    ) {}

    /**
     * ONE call, no retry: the caller counts its tries (the shop-document critic gives three in total, the owner's AI-error rule) and
     * says which one this is (`attempt`, 1 for the first): that number is what the usage record and the log carry. Answers the parsed
     * value, `cut` when the answer was cut at the token cap (by its finish reason; never parsed), `unreadable` when a whole answer did
     * not fit the schema (both are still recorded), or `unavailable`.
     */
    protected async askOnce<T>(params: ModelCallParams<T>, attempt = 1): Promise<ModelCallResult<T> | "unreadable" | "unavailable" | "cut"> {
        const answer = await this.attempt(params, attempt)
        if (answer === null) return "unavailable"
        if (answer.cut) return "cut"
        if (answer.value === null) return "unreadable"
        return { value: answer.value, model: answer.model, promptTokens: answer.promptTokens, completionTokens: answer.completionTokens }
    }

    /**
     * One call of the model with its usage recorded; null when the model is unavailable. An answer CUT at the token cap is booked with
     * what it spent (D-BR-15: a call that returned tokens is booked whatever its finish reason) and is told apart as `cut`.
     */
    private async attempt<T>(params: ModelCallParams<T>, attempt: number): Promise<Attempt<T> | null> {
        const tried = await this.ai.attempt({
            messages: [
                { role: "system", content: params.system, ...(params.cached === true ? { cacheMark: true } : {}) },
                ...(params.context === undefined
                    ? []
                    : [{ role: "user" as const, content: params.context, ...(params.cached === true ? { cacheMark: true } : {}) }]),
                { role: "user", content: params.user },
            ],
            json: true,
            schema: params.schema,
            timeoutMs: params.timeoutMs,
            budget: params.budget,
            context: null,
            ...(params.target === undefined ? {} : { target: params.target }),
            ...(params.cached === true ? { affinity: params.workspaceId } : {}),
            ...(params.outputSchema === undefined ? {} : { outputSchema: params.outputSchema }),
        })
        const spend = spendOf(tried)
        if (spend !== null) {
            await this.usage.record({
                workspaceId: params.workspaceId,
                kind: "brain",
                module: "dossier_review",
                promptChars: params.system.length + (params.context?.length ?? 0) + params.user.length,
                tryNumber: attempt,
                ...spend,
            })
        }
        if (!tried.ok) {
            if (tried.failure !== "length" || tried.spent === undefined) return null
            this.logger.warn(DossierReviewAiLogEvent.AnswerCut, { purpose: params.purpose, attempt, cap: params.budget.maxTokens ?? null })
            return {
                value: null,
                cut: true,
                model: tried.spent.model,
                promptTokens: tried.spent.usage.promptTokens,
                completionTokens: tried.spent.usage.completionTokens,
            }
        }
        const answer = tried.answer
        const parsed = this.read(params.schema, answer)
        if (!parsed.success) {
            this.logger.warn(DossierReviewAiLogEvent.AnswerUnreadable, { purpose: params.purpose, attempt })
        }
        return {
            value: parsed.success ? parsed.data : null,
            cut: false,
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
        const body = text.replaceAll(FENCE, "")
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
