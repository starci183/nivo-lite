import type { RunCallKindUsage } from "./ai-usage-events.contracts"

/** One row of a run's call-kind rollup as the driver answers it: sums cast to numbers in SQL, the lists as text arrays. */
export interface RunCallKindAggregate {
    /** The call kind, or the usage kind of a fixed task. */
    readonly purpose: string
    /** Calls booked. */
    readonly calls: number
    /** The highest try number, or null when no call told it. */
    readonly max_try: number | null
    /** Prompt tokens. */
    readonly prompt_tokens: number
    /** Cached prompt tokens. */
    readonly cached_tokens: number
    /** Completion tokens. */
    readonly completion_tokens: number
    /** Hidden reasoning tokens. */
    readonly reasoning_tokens: number
    /** Summed wall time, milliseconds. */
    readonly duration_ms: number
    /** The slowest call, milliseconds, or null. */
    readonly slowest_ms: number | null
    /** Cost in USD. */
    readonly cost_usd: number
    /** The upstreams that served the calls (nulls where one did not say), or null. */
    readonly upstreams: ReadonlyArray<string | null> | null
    /** The finish reasons (nulls where one did not say), or null. */
    readonly finish_reasons: ReadonlyArray<string | null> | null
    /** The models that served the calls, or null. */
    readonly models?: ReadonlyArray<string | null> | null
    /** What the nodes declared, or null. */
    readonly declared_models?: ReadonlyArray<string | null> | null
    /** The providers of the served models, or null. */
    readonly model_providers?: ReadonlyArray<string | null> | null
    /** Why the calls went to those models, or null. */
    readonly model_reasons?: ReadonlyArray<string | null> | null
}

/** The named values of a text array, sorted, without repeats. */
const namesOf = (values: ReadonlyArray<string | null> | null): ReadonlyArray<string> =>
    [...new Set((values ?? []).filter((value): value is string => value !== null && value !== ""))].sort((left, right) =>
        left.localeCompare(right),
    )

/** A count the driver answered, as a whole number; zero for anything that is not one. */
const countOf = (value: number | null): number => (typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0)

/** Reads one rollup row of a run's calls without exposing its column names. */
export const toRunCallKind = (row: RunCallKindAggregate): RunCallKindUsage => ({
    purpose: row.purpose,
    calls: countOf(row.calls),
    maxTry: row.max_try === null ? null : countOf(row.max_try),
    promptTokens: countOf(row.prompt_tokens),
    cachedTokens: countOf(row.cached_tokens),
    completionTokens: countOf(row.completion_tokens),
    reasoningTokens: countOf(row.reasoning_tokens),
    durationMs: countOf(row.duration_ms),
    slowestMs: row.slowest_ms === null ? null : countOf(row.slowest_ms),
    costUsd: typeof row.cost_usd === "number" && Number.isFinite(row.cost_usd) ? row.cost_usd : 0,
    upstreams: namesOf(row.upstreams),
    finishReasons: namesOf(row.finish_reasons),
    models: namesOf(row.models ?? null),
    declaredModels: namesOf(row.declared_models ?? null),
    modelProviders: namesOf(row.model_providers ?? null),
    modelReasons: namesOf(row.model_reasons ?? null),
})
