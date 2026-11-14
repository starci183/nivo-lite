import type { WorkScope } from "@modules/platform/logging"
import type { MeterCallFacts, ProviderUsage, UsageFigures, UsageWork } from "./ai-usage-events.contracts"

/** The longest work kind, record, step and failure booked, in characters (the columns' checks, migration 014000). */
const KIND_CHARS = 40
const REF_CHARS = 200
const STEP_CHARS = 120
const FAILURE_CHARS = 40

/** A uuid as the column takes it. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A text cut to the column, or null when empty. */
const textOf = (value: string | null | undefined, chars: number): string | null =>
    value === null || value === undefined || value.trim() === "" ? null : value.trim().slice(0, chars)

/** The columns of `ai_usage_events` that say which work a call served, and whether it was a failed try. */
export interface WorkColumns {
    /** The kind of work, or null. */
    readonly workKind: string | null
    /** The record it served, or null. */
    readonly workRef: string | null
    /** The run step (graph node key), or null. */
    readonly stepKey: string | null
    /** The agent, or null when not a uuid. */
    readonly agentId: string | null
    /** Prompt tokens written to the provider's cache. */
    readonly cacheWriteTokens: number
    /** The failure of a failed try, or null for an answer. */
    readonly failure: string | null
}

/** The work a call served: the work the caller named, the work in scope, or none. */
export type ColumnsWork = UsageWork | WorkScope | null | undefined

/** The provider's usage figures of a call, or null when it reported none. */
export type ColumnsUsage = ProviderUsage | null

/** The figures of a call that say whether its numbers were estimated. */
export type ColumnsFigures = Pick<UsageFigures, "estimated">

/** The failure kind of a failed try, or undefined for an answer. */
export type ColumnsFailure = string | undefined

/**
 * The work columns of a call: the work the caller named, else the work in scope, else none. Cache writes are a provider's count and
 * never estimated (an estimated call, a failed try among them, books none).
 */
export const workColumnsOf = (
    work: ColumnsWork,
    usage: ColumnsUsage,
    figures: ColumnsFigures,
    failure: ColumnsFailure,
): WorkColumns => {
    const written = usage?.cache_write_tokens
    const agent = textOf(work?.agentId, 36)
    return {
        workKind: textOf(work?.kind, KIND_CHARS),
        workRef: textOf(work?.ref, REF_CHARS),
        stepKey: textOf(work?.stepKey, STEP_CHARS),
        agentId: agent !== null && UUID.test(agent) ? agent : null,
        cacheWriteTokens:
            figures.estimated || typeof written !== "number" || !Number.isFinite(written) || written < 0
                ? 0
                : Math.round(written),
        failure: textOf(failure, FAILURE_CHARS),
    }
}

/** The run a call served, or null when it served none. */
export type FactsRunId = string | null

/** The work facts the knowledge meter's SQL writer takes, one snake-case member per fact. */
export interface WorkFactsJson {
    /** One fact, under its snake-case name. */
    readonly [fact: string]: string | number | null
}

/** The work facts the knowledge meter's SQL writer takes (`record_ai_usage_work`), snake case as the function reads them. */
export const workFactsJsonOf = (columns: WorkColumns, runId: FactsRunId, call: MeterCallFacts): WorkFactsJson => ({
    run_id: runId,
    work_kind: columns.workKind,
    work_ref: columns.workRef,
    step_key: columns.stepKey,
    agent_id: columns.agentId,
    failure: columns.failure,
    try_number: call.tryNumber ?? null,
    duration_ms: call.durationMs ?? null,
    purpose: call.purpose ?? null,
    upstream: call.upstream ?? null,
    finish_reason: call.finishReason ?? null,
})
