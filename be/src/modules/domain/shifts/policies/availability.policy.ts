import type { Avail, Leave } from "../shifts.contracts"
import { toMin, weekdayOf } from "./time.policy"

/** A window of minutes inside a day. */
type Window = readonly [number, number]

/** Merges windows that overlap or touch (07-12 and 12-18 are one window 07-18), earliest first. */
const mergeWindows = (windows: ReadonlyArray<Window>): Array<Window> =>
    [...windows]
        .sort((a, b) => a[0] - b[0])
        .reduce<Array<Window>>((merged, window) => {
            const last = merged.at(-1)
            if (last !== undefined && window[0] <= last[1]) {
                return [...merged.slice(0, -1), [last[0], Math.max(last[1], window[1])]]
            }
            return [...merged, window]
        }, [])

/**
 * True when [start, end] on `date` lies inside what the person said they can work. Recurring rows apply by weekday; a row
 * for the exact date replaces them for that day. No statement at all means the person is free.
 */
export const isAvailable = (
    avail: ReadonlyArray<Avail>,
    staffId: string,
    date: string,
    start: number,
    end: number,
): boolean => {
    const mine = avail.filter((row) => row.staffId === staffId)
    const overrides = mine.filter((row) => row.date === date)
    const rows =
        overrides.length > 0 ? overrides : mine.filter((row) => row.weekday === weekdayOf(date) && row.date === null)
    const yes = rows.filter((row) => row.available)
    const blocked = rows.some((row) => !row.available && toMin(row.start) < end && toMin(row.end) > start)
    if (blocked) return false
    if (yes.length === 0) return true
    const windows = mergeWindows(yes.map((row): Window => [toMin(row.start), toMin(row.end)]))
    return windows.some(([from, to]) => from <= start && to >= end)
}

/** True when the person is on approved leave on `date`. */
export const onLeave = (leaves: ReadonlyArray<Leave>, staffId: string, date: string): boolean =>
    leaves.some((leave) => leave.staffId === staffId && leave.from <= date && leave.to >= date)
