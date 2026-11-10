import type { DailyModuleUsage, QuotaLookup, UsageSummary } from "./ai-usage-events.contracts"
import { creditsOf } from "./usage-cost.policy"
import { creditsExact, usdExact } from "./credits.policy"
import type { DailyWorkUsage } from "./work-usage.contracts"
import { countOf, numberOf } from "./work-usage.mapper"
import type { Figure } from "./work-usage.mapper"

/** One non-guide daily rollup, aggregated across kinds, as the monthly aggregate answers it. */
export interface MonthlyUsageAggregate {
    /** The day in Vietnam time, YYYY-MM-DD. */
    readonly day: string
    /** The module or shared usage bucket. */
    readonly module: string
    /** Number of calls. */
    readonly calls: number
    /** Prompt and completion tokens. */
    readonly tokens: number
    /** Model cost in USD. */
    readonly cost_usd: number
}

/** Reads the monthly rollup without exposing its database column names. */
export const toDailyModuleUsage = (row: MonthlyUsageAggregate): DailyModuleUsage => ({
    day: row.day,
    module: row.module,
    calls: row.calls,
    tokens: row.tokens,
    costUsd: row.cost_usd,
})

interface Accumulator {
    readonly calls: number
    readonly tokens: number
    readonly costUsd: number
}

const add = (total: Accumulator | undefined, row: DailyModuleUsage): Accumulator => ({
    calls: (total?.calls ?? 0) + row.calls,
    tokens: (total?.tokens ?? 0) + row.tokens,
    costUsd: (total?.costUsd ?? 0) + row.costUsd,
})

/** Groups rollups into the module split and daily credit chart. */
export const toUsageSummary = (status: QuotaLookup, rows: ReadonlyArray<DailyModuleUsage>): UsageSummary => {
    const modules = new Map<string, Accumulator>()
    const days = new Map<string, Accumulator>()
    for (const row of rows) {
        modules.set(row.module, add(modules.get(row.module), row))
        days.set(row.day, add(days.get(row.day), row))
    }
    return {
        status,
        byModule: [...modules.entries()]
            .map(([module, total]) => ({ module, ...total, credits: creditsOf(total.costUsd) }))
            .sort((left, right) => right.credits - left.credits),
        daily: [...days.entries()]
            .map(([day, total]) => ({ day, tokens: total.tokens, credits: creditsOf(total.costUsd) }))
            .sort((left, right) => left.day.localeCompare(right.day)),
    }
}

/** One day, module and work kind's rollup as the driver answers it. */
export interface DailyWorkAggregate {
    readonly day: string
    readonly module: string
    readonly work_kind: string
    readonly calls: Figure
    readonly failed_tries: Figure
    readonly tokens: Figure
    readonly cost_usd: Figure
    readonly failed_cost_usd: Figure
}

/**
 * Reads one day, module and work kind's rollup of the workspace summary. Its credits are EXACT fractions (display): only a bill rounds,
 * and it rounds the month's total (`ai_credit_period`), never a day of this summary.
 */
export const toDailyWorkUsage = (row: DailyWorkAggregate): DailyWorkUsage => {
    const costUsd = usdExact(numberOf(row.cost_usd))
    return {
        day: row.day,
        module: row.module,
        workKind: row.work_kind,
        calls: countOf(row.calls),
        failedTries: countOf(row.failed_tries),
        tokens: countOf(row.tokens),
        costUsd,
        failedCostUsd: usdExact(numberOf(row.failed_cost_usd)),
        credits: creditsExact(costUsd),
    }
}
