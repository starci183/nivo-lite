import { usdExact } from "./credits.policy"
import { creditsOf } from "./usage-cost.policy"
import type { AgentStepUsage, DocumentAiCost, WorkCost, WorkKindUsage } from "./work-usage.contracts"

/** A figure as the driver answers it (sums are cast to float8 in SQL, so numbers; text tolerated). */
export type Figure = number | string | null

/** One step's rollup of an agent's calls as the driver answers it. */
export interface AgentStepAggregate {
    /** The step key the calls belong to. */
    readonly step_key: string
    /** Runs that reached the step. */
    readonly runs: Figure
    /** Calls the step made. */
    readonly calls: Figure
    /** Tries that failed. */
    readonly failed_tries: Figure
    /** Cost of all calls, in USD. */
    readonly cost_usd: Figure
    /** Cost of the failed tries, in USD. */
    readonly failed_cost_usd: Figure
    /** Average duration of a call, in milliseconds. */
    readonly average_ms: Figure
    /** The models the calls used, as the driver lists them. */
    readonly models: ReadonlyArray<string | null> | null
}

/** One record and work kind's rollup as the driver answers it. */
export interface WorkKindAggregate {
    /** The record the work belongs to. */
    readonly work_ref: string
    /** The kind of work. */
    readonly work_kind: string
    /** Calls the step made. */
    readonly calls: Figure
    /** Tries that failed. */
    readonly failed_tries: Figure
    /** Tokens the calls used. */
    readonly tokens: Figure
    /** Cost of all calls, in USD. */
    readonly cost_usd: Figure
    /** Cost of the failed tries, in USD. */
    readonly failed_cost_usd: Figure
    /** The models the calls used, as the driver lists them. */
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
    const credits = creditsOf(costUsd)
    return {
        stepKey: row.step_key,
        runs,
        calls: countOf(row.calls),
        failedTries: countOf(row.failed_tries),
        costUsd,
        failedCostUsd: usdExact(numberOf(row.failed_cost_usd)),
        credits,
        creditsPerRun: runs === 0 ? 0 : creditsOf(costUsd / runs),
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
        credits: creditsOf(costUsd),
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

/** One figure of some rows added up. */
export const summed = <Row>(rows: ReadonlyArray<Row>, pick: (row: Row) => number): number =>
    rows.reduce((total, row) => total + pick(row), 0)

/** The exact cost of the answers and of the failed tries given as sums in USD, each with its credits turned once (never per call). */
export const costFiguresOf = (
    costSum: number,
    failedCostSum: number,
): Pick<WorkCost, "costUsd" | "credits" | "failedCostUsd" | "failedCredits"> => {
    const costUsd = usdExact(costSum)
    const failedCostUsd = usdExact(failedCostSum)
    return { costUsd, credits: creditsOf(costUsd), failedCostUsd, failedCredits: creditsOf(failedCostUsd) }
}

/** The cost of some kinds of work summed: the exact cost first, then credits once (never per call). */
export const workCostOf = (rows: ReadonlyArray<WorkKindUsage>): WorkCost => ({
    calls: summed(rows, (row) => row.calls),
    failedTries: summed(rows, (row) => row.failedTries),
    tokens: summed(rows, (row) => row.tokens),
    ...costFiguresOf(
        summed(rows, (row) => row.costUsd),
        summed(rows, (row) => row.failedCostUsd),
    ),
})

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
