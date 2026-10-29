import type { DailyModuleUsage, QuotaLookup, UsageSummary } from "./ai-usage-events.contracts"
import { creditsOf } from "./usage-cost.policy"

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
