import type { RunAiTotals, RunCallKindUsage } from "./ai-usage-events.contracts"
import { usdExact } from "./credits.policy"
import { creditsOf } from "./usage-cost.policy"
import { costFiguresOf, summed } from "./work-usage.mapper"

/** One row of a run's call-kind rollup as the driver answers it: sums cast to numbers in SQL, the lists as text arrays. */
export interface RunCallKindAggregate {
    /** The run step, or null. */
    readonly step_key?: string | null
    /** Every try booked; absent in a row read before U1 (then the answers). */
    readonly tries?: number | null
    /** The failed tries. */
    readonly failed_tries?: number | null
    /** Prompt tokens written to the cache. */
    readonly cache_write_tokens?: number | null
    /** Prompt tokens of the failed tries. */
    readonly failed_prompt_tokens?: number | null
    /** The price of the failed tries in USD. */
    readonly failed_cost_usd?: number | null
    /** The failure codes, or null. */
    readonly failures?: ReadonlyArray<string | null> | null
    /** The work kinds, or null. */
    readonly work_kinds?: ReadonlyArray<string | null> | null
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
    [...new Set((values ?? []).filter((value): value is string => value !== null && value !== ""))].sort(
        (left, right) => left.localeCompare(right),
    )

/** A count the driver answered, as a whole number; zero for anything that is not one. */
const countOf = (value: number | null): number =>
    typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0

/** A cost the driver answered, in USD; zero for anything that is not one. */
const usdOf = (value: number | null | undefined): number => usdExact(typeof value === "number" ? value : 0)

/** Reads one rollup row of a run's calls without exposing its column names; credits are exact fractions of the exact cost. */
export const toRunCallKind = (row: RunCallKindAggregate): RunCallKindUsage => ({
    stepKey: row.step_key ?? null,
    purpose: row.purpose,
    calls: countOf(row.calls),
    tries: row.tries === undefined || row.tries === null ? countOf(row.calls) : countOf(row.tries),
    failedTries: countOf(row.failed_tries ?? null),
    cacheWriteTokens: countOf(row.cache_write_tokens ?? null),
    failedPromptTokens: countOf(row.failed_prompt_tokens ?? null),
    failedCostUsd: usdOf(row.failed_cost_usd),
    failures: namesOf(row.failures ?? null),
    workKinds: namesOf(row.work_kinds ?? null),
    credits: creditsOf(usdOf(row.cost_usd)),
    failedCredits: creditsOf(usdOf(row.failed_cost_usd)),
    maxTry: row.max_try === null ? null : countOf(row.max_try),
    promptTokens: countOf(row.prompt_tokens),
    cachedTokens: countOf(row.cached_tokens),
    completionTokens: countOf(row.completion_tokens),
    reasoningTokens: countOf(row.reasoning_tokens),
    durationMs: countOf(row.duration_ms),
    slowestMs: row.slowest_ms === null ? null : countOf(row.slowest_ms),
    costUsd: usdOf(row.cost_usd),
    upstreams: namesOf(row.upstreams),
    finishReasons: namesOf(row.finish_reasons),
    models: namesOf(row.models ?? null),
    declaredModels: namesOf(row.declared_models ?? null),
    modelProviders: namesOf(row.model_providers ?? null),
    modelReasons: namesOf(row.model_reasons ?? null),
})

/** The totals of a run from its steps' rows: the exact cost summed, then turned into credits once (a fraction, never rounded per call). */
export const runTotalsOf = (rows: ReadonlyArray<RunCallKindUsage>): RunAiTotals => {
    const sum = (pick: (row: RunCallKindUsage) => number): number => summed(rows, pick)
    return {
        calls: sum((row) => row.calls),
        tries: sum((row) => row.tries),
        failedTries: sum((row) => row.failedTries),
        promptTokens: sum((row) => row.promptTokens),
        cachedTokens: sum((row) => row.cachedTokens),
        cacheWriteTokens: sum((row) => row.cacheWriteTokens),
        completionTokens: sum((row) => row.completionTokens),
        reasoningTokens: sum((row) => row.reasoningTokens),
        ...costFiguresOf(
            sum((row) => row.costUsd),
            sum((row) => row.failedCostUsd),
        ),
    }
}
