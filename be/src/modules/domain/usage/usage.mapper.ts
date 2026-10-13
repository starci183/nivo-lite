import type { DailyModuleRow } from "./persistence/usage.rows"
import type { DailyUsage, ModuleUsage, QuotaLookup, UsageSummary } from "./usage.contracts"
import { creditsOf } from "./usage-cost.policy"

interface Accumulator {
    readonly calls: number
    readonly tokens: number
    readonly costUsd: number
}

const add = (total: Accumulator | undefined, row: DailyModuleRow): Accumulator => ({
    calls: (total?.calls ?? 0) + row.calls,
    tokens: (total?.tokens ?? 0) + row.tokens,
    costUsd: (total?.costUsd ?? 0) + row.cost_usd,
})

/** Groups the daily rollup rows by module and by day: the modules costliest first, the days in order. */
export const toUsageSummary = (status: QuotaLookup, rows: ReadonlyArray<DailyModuleRow>): UsageSummary => {
    const modules = new Map<string, Accumulator>()
    const days = new Map<string, Accumulator>()
    for (const row of rows) {
        modules.set(row.module, add(modules.get(row.module), row))
        days.set(row.day, add(days.get(row.day), row))
    }
    const byModule: Array<ModuleUsage> = [...modules.entries()]
        .map(([module, total]) => ({ module, ...total, credits: creditsOf(total.costUsd) }))
        .sort((left, right) => right.credits - left.credits)
    const daily: Array<DailyUsage> = [...days.entries()].map(([day, total]) => ({
        day,
        tokens: total.tokens,
        credits: creditsOf(total.costUsd),
    }))
    return { status, byModule, daily }
}
