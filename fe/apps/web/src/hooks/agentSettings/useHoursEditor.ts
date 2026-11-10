"use client"

import { useMemo, useState } from "react"
import {
    HOURS_END_MIN,
    HOURS_START_MIN,
    SLOTS_PER_DAY,
    SLOT_MIN,
    clockOf,
    minutesOf,
    rangesOf,
    withDayRanges,
} from "@/modules/workingHours"
import type { WeekSlots } from "@/modules/workingHours"

/** One stretch of duty as the list shows it: "HH:mm" at both ends. */
export interface ClockRange {
    readonly start: string
    readonly end: string
}

/** A time a range end may take. */
export interface ClockOption {
    readonly id: string
    readonly label: string
}

/** One row of the hours list: the days it stands for (consecutive days with identical ranges) and their ranges. */
export interface HoursRow {
    readonly id: string
    readonly days: ReadonlyArray<number>
    readonly ranges: ReadonlyArray<ClockRange>
    /** Whether another range still fits on the day. */
    readonly canAdd: boolean
}

/** What the hours list reads and calls; a command on a row applies to every day the row stands for. */
export interface HoursEditorView {
    readonly rows: ReadonlyArray<HoursRow>
    /** The times a range may start at, and the times it may end at, in half-hour steps. */
    readonly startOptions: ReadonlyArray<ClockOption>
    readonly endOptions: ReadonlyArray<ClockOption>
    readonly add: (days: ReadonlyArray<number>) => void
    readonly remove: (days: ReadonlyArray<number>, at: number) => void
    /** Changes one end of one range; an end that would make the range empty or is not a time is ignored. */
    readonly edit: (days: ReadonlyArray<number>, at: number, side: "start" | "end", clock: string) => void
    /** Shows each day of a merged row on its own row from now on, so one day can be edited alone. */
    readonly split: (days: ReadonlyArray<number>) => void
}

const optionsOf = (from: number, count: number): ReadonlyArray<ClockOption> =>
    Array.from({ length: count }, (_, at) => {
        const clock = clockOf(from + at * SLOT_MIN)
        return { id: clock, label: clock }
    })

const START_OPTIONS = optionsOf(HOURS_START_MIN, SLOTS_PER_DAY)
const END_OPTIONS = optionsOf(HOURS_START_MIN + SLOT_MIN, SLOTS_PER_DAY)

const clocksOf = (week: WeekSlots, day: number): ReadonlyArray<ClockRange> =>
    rangesOf(week[day] ?? []).map((range) => ({ start: clockOf(range.start), end: clockOf(range.end) }))

const sameClocks = (left: ReadonlyArray<ClockRange>, right: ReadonlyArray<ClockRange>): boolean =>
    left.length === right.length &&
    left.every((range, at) => range.start === right[at]?.start && range.end === right[at]?.end)

/** Groups the days into rows: consecutive days with identical ranges share a row, except the days the owner split out. */
const rowsOf = (week: WeekSlots, alone: ReadonlySet<number>): ReadonlyArray<HoursRow> => {
    const groups: Array<Array<number>> = []
    week.forEach((_, day) => {
        const last = groups[groups.length - 1]
        const before = last?.[last.length - 1]
        const joins =
            last !== undefined &&
            before !== undefined &&
            !alone.has(day) &&
            !alone.has(before) &&
            sameClocks(clocksOf(week, before), clocksOf(week, day))
        if (joins) last.push(day)
        else groups.push([day])
    })
    return groups.map((days) => {
        const ranges = clocksOf(week, days[0] ?? 0)
        const end = ranges[ranges.length - 1]?.end
        return {
            id: days.join("-"),
            days,
            ranges,
            canAdd: end === undefined || (minutesOf(end) ?? 0) < HOURS_END_MIN,
        }
    })
}

const applyToDays = (
    week: WeekSlots,
    days: ReadonlyArray<number>,
    change: (ranges: ReadonlyArray<{ start: number; end: number }>) => ReadonlyArray<{ start: number; end: number }>,
): WeekSlots => days.reduce((current, day) => withDayRanges(current, day, change(rangesOf(current[day] ?? []))), week)

/** The editing operations of the hours list over the slot model: one place for grouping, adding, removing, editing and splitting. */
export const useHoursEditor = (week: WeekSlots, onChange: (week: WeekSlots) => void): HoursEditorView => {
    const [alone, setAlone] = useState<ReadonlySet<number>>(new Set())
    return useMemo(
        () => ({
            rows: rowsOf(week, alone),
            startOptions: START_OPTIONS,
            endOptions: END_OPTIONS,
            add: (days) =>
                onChange(
                    applyToDays(week, days, (ranges) => {
                        const start = ranges[ranges.length - 1]?.end ?? 8 * 60
                        const end = Math.min(HOURS_END_MIN, start + 120)
                        return end > start ? [...ranges, { start, end }] : ranges
                    }),
                ),
            remove: (days, at) =>
                onChange(applyToDays(week, days, (ranges) => ranges.filter((_, index) => index !== at))),
            edit: (days, at, side, clock) => {
                const minutes = minutesOf(clock)
                if (minutes === null) return
                onChange(
                    applyToDays(week, days, (ranges) =>
                        ranges.map((range, index) => {
                            const next = index === at ? { ...range, [side]: minutes } : range
                            return next.end > next.start ? next : range
                        }),
                    ),
                )
            },
            split: (days) => setAlone((current) => new Set([...current, ...days])),
        }),
        [week, alone, onChange],
    )
}
