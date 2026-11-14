import type { CallRecordsTally } from "./tool-call-log.contracts"

/** A count or a sum as the driver hands it: PostgreSQL may send text, and a sum over nothing is null. */
export type DriverCount = string | number | null

/** One group of the records statement, as the driver hands it (a sum or a count of PostgreSQL may arrive as text). */
export interface CallRecordsRow {
    /** The run of the group, or null for a window. */
    readonly run_id: string | null
    /** Every `ok` call of the group. */
    readonly calls: DriverCount
    /** The sum of the stated read counts, or null when none stated one. */
    readonly read_sum: DriverCount
    /** How many calls stated a read count. */
    readonly read_stated: DriverCount
    /** The sum of the stated change counts, or null when none stated one. */
    readonly changed_sum: DriverCount
    /** How many calls stated a change count. */
    readonly changed_stated: DriverCount
    /** How many calls stated neither. */
    readonly uncounted: DriverCount
}

/** A count of the driver as a number; anything unreadable is 0. */
const countOf = (value: DriverCount): number => {
    const read = typeof value === "number" ? value : Number(value ?? 0)
    return Number.isFinite(read) ? read : 0
}

/** A stated sum: 0 when no call was made, null when calls were made and none stated the count, else the sum. */
const statedOf = (calls: number, stated: number, sum: DriverCount): number | null => {
    if (calls === 0) return 0
    return stated === 0 ? null : countOf(sum)
}

/** The tally of one group of the records statement. */
export const callRecordsTallyOf = (row: CallRecordsRow): CallRecordsTally => {
    const calls = countOf(row.calls)
    return {
        runId: row.run_id,
        read: statedOf(calls, countOf(row.read_stated), row.read_sum),
        changed: statedOf(calls, countOf(row.changed_stated), row.changed_sum),
        uncounted: countOf(row.uncounted),
    }
}

/** The tally of a window with no `ok` call at all. */
export const NO_CALLS: CallRecordsTally = { runId: null, read: 0, changed: 0, uncounted: 0 }
