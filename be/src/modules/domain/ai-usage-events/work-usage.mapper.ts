import { creditsExact, usdExact } from "./credits.policy"
import type { AgentStepUsage, DocumentAiCost, WorkCost, WorkKindUsage } from "./work-usage.contracts"

/** A figure as the driver answers it (sums are cast to float8 in SQL, so numbers; text tolerated). */
export type Figure = number | string | null

/** One step's rollup of an agent's calls as the driver answers it. */
export interface AgentStepAggregate {
    readonly step_key: string
    readonly runs: Figure
    readonly calls: Figure
    readonly failed_tries: Figure
    readonly cost_usd: Figure
    readonly failed_cost_usd: Figure
    readonly average_ms: Figure
    readonly models: ReadonlyArray<string | null> | null
}

/** One record and work kind's rollup as the driver answers it. */
export interface WorkKindAggregate {
    readonly work_ref: string
    readonly work_kind: string
    readonly calls: Figure
    readonly failed_tries: Figure
    readonly tokens: Figure
    readonly cost_usd: Figure
    readonly failed_cost_usd: Figure
    readonly models: ReadonlyArray<string | null> | null
}

/** A finite number of a figure, else zero. */
export const numberOf = (value: Figure | undefined): number => {
    const parsed = typeof value === "string" ? Number(value) : value
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0
}

/** A whole count of a figure. */
export const countOf = (value: Figure | undefined): number => Math.max(0, Math.round(numberOf(value)))

/** The named values of a text array, sorted, without repeats. */
const namesOf = (values: ReadonlyArray<string | null> | null): ReadonlyArray<string> =>
    [...new Set((values ?? []).filter((value): value is string => value !== null && value !== ""))].sort(
        (left, right) => left.localeCompare(right),
    )

/** Reads one step's rollup; the credits per run are the exact credits over the runs. */
export const toAgentStepUsage = (row: AgentStepAggregate): AgentStepUsage => {
    const runs = countOf(row.runs)
    const costUsd = usdExact(numberOf(row.cost_usd))
    const credits = creditsExact(costUsd)
    return {
        stepKey: row.step_key,
        runs,
        calls: countOf(row.calls),
        failedTries: countOf(row.failed_tries),
        costUsd,
        failedCostUsd: usdExact(numberOf(row.failed_cost_usd)),
        credits,
        creditsPerRun: runs === 0 ? 0 : creditsExact(costUsd / runs),
        averageMs: row.average_ms === null ? null : countOf(row.average_ms),
        models: namesOf(row.models),
    }
}

/** Reads one record and work kind's rollup. */
export const toWorkKindUsage = (row: WorkKindAggregate): WorkKindUsage => {
    const costUsd = usdExact(numberOf(row.cost_usd))
    return {
        ref: row.work_ref,
        workKind: row.work_kind,
        calls: countOf(row.calls),
        failedTries: countOf(row.failed_tries),
        tokens: countOf(row.tokens),
        costUsd,
        failedCostUsd: usdExact(numberOf(row.failed_cost_usd)),
        credits: creditsExact(costUsd),
        models: namesOf(row.models),
    }
}

/** The records' use grouped by record: each record's work kinds, in the order read. */
export const byRef = (rows: ReadonlyArray<WorkKindUsage>): ReadonlyMap<string, ReadonlyArray<WorkKindUsage>> => {
    const grouped = new Map<string, Array<WorkKindUsage>>()
    for (const row of rows) grouped.set(row.ref, [...(grouped.get(row.ref) ?? []), row])
    return grouped
}

/** The work kinds of a document's reading, critique and re-reading (any other kind booked to it counts in the total only). */
const DOCUMENT_READ = "document_read"
const DOCUMENT_CRITIQUE = "document_critique"
const DOCUMENT_REREAD = "document_reread"

/** The cost of some kinds of work summed: the exact cost first, then credits once (never per call). */
export const workCostOf = (rows: ReadonlyArray<WorkKindUsage>): WorkCost => {
    const sum = (pick: (row: WorkKindUsage) => number): number => rows.reduce((total, row) => total + pick(row), 0)
    const costUsd = usdExact(sum((row) => row.costUsd))
    const failedCostUsd = usdExact(sum((row) => row.failedCostUsd))
    return {
        calls: sum((row) => row.calls),
        failedTries: sum((row) => row.failedTries),
        tokens: sum((row) => row.tokens),
        costUsd,
        credits: creditsExact(costUsd),
        failedCostUsd,
        failedCredits: creditsExact(failedCostUsd),
    }
}

/** What one document cost, per kind of work, from its rows (`byRefs` of `source:<id>`). */
export const documentCostOf = (rows: ReadonlyArray<WorkKindUsage>): DocumentAiCost => {
    const of = (kind: string): WorkCost => workCostOf(rows.filter((row) => row.workKind === kind))
    return {
        read: of(DOCUMENT_READ),
        critique: of(DOCUMENT_CRITIQUE),
        reread: of(DOCUMENT_REREAD),
        total: workCostOf(rows),
        models: [...new Set(rows.flatMap((row) => row.models))].sort((left, right) => left.localeCompare(right)),
    }
}
