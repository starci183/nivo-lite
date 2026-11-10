import type { UsageCallFacts, UsageFigures } from "./ai-usage-events.contracts"

/** The longest kind, upstream and finish reason booked, in characters (the columns' checks). */
const PURPOSE_CHARS = 200
const UPSTREAM_CHARS = 120
const FINISH_CHARS = 40
/** The longest declared model, provider and reason booked, in characters (the columns' checks, migration 012800). */
const DECLARED_CHARS = 120
const PROVIDER_CHARS = 40
const REASON_CHARS = 40
/** The highest try number the column takes. */
const MAX_TRY = 10

/** A whole count of at least zero, or null for anything else. */
const wholeOf = (value: number | null): number | null =>
    value !== null && Number.isFinite(value) && value >= 0 ? Math.round(value) : null

/** A text cut to the column, or null when empty. */
const textOf = (value: string | null, chars: number): string | null =>
    value === null || value.trim() === "" ? null : value.trim().slice(0, chars)

/** The columns of `ai_usage_events` that say what a call was and how it went. */
export interface CallColumns {
    /** The call kind, or null. */
    readonly purpose: string | null
    /** Hidden reasoning tokens, within the completion. */
    readonly reasoningTokens: number
    /** Wall time of the answering try, milliseconds, or null. */
    readonly durationMs: number | null
    /** Which try answered, or null. */
    readonly tryNumber: number | null
    /** The upstream that served it, or null. */
    readonly upstream: string | null
    /** Why the model stopped, or null. */
    readonly finishReason: string | null
    /** What a graph node's call declared (`auto` or a model id), or null. */
    readonly declaredModel: string | null
    /** The provider of the model that served the call, or null. */
    readonly modelProvider: string | null
    /** Why the call went to that model, or null. */
    readonly modelReason: string | null
}

/**
 * The columns of what a call was and how it went. The hidden reasoning is a part of the completion it was written with: it is never
 * estimated (an estimated call books none) and never exceeds the completion. A try number outside the column's range is not booked.
 */
export const callColumnsOf = (call: UsageCallFacts | undefined, figures: UsageFigures): CallColumns => {
    const tryNumber = wholeOf(call?.tryNumber ?? null)
    return {
        purpose: textOf(call?.purpose ?? null, PURPOSE_CHARS),
        reasoningTokens: figures.estimated
            ? 0
            : Math.min(wholeOf(call?.reasoningTokens ?? null) ?? 0, figures.completionTokens),
        durationMs: wholeOf(call?.durationMs ?? null),
        tryNumber: tryNumber !== null && tryNumber >= 1 && tryNumber <= MAX_TRY ? tryNumber : null,
        upstream: textOf(call?.upstream ?? null, UPSTREAM_CHARS),
        finishReason: textOf(call?.finishReason ?? null, FINISH_CHARS),
        declaredModel: textOf(call?.declaredModel ?? null, DECLARED_CHARS),
        modelProvider: textOf(call?.modelProvider ?? null, PROVIDER_CHARS),
        modelReason: textOf(call?.modelReason ?? null, REASON_CHARS),
    }
}
