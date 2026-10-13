"use client"

import { useFormatter } from "next-intl"
import { useMemo } from "react"
import { isoAddDays, isoWeekdayIndex } from "@/hooks/shiftsTime"

const REFERENCE_MONDAY = "2024-01-01"
const HALF_HOUR = 30
const OPENING_FROM_HOUR = 5
const MIDNIGHT = 24

/** One choice of a select. */
interface ShiftsOption {
    readonly id: string
    readonly label: string
}

/** The display forms of the shifts screens: dates, weekday names, wages, hours and the choices of the time and date selects. */
interface ShiftsFormat {
    /** "13/10" style day and month of a "YYYY-MM-DD" date. */
    readonly dayMonth: (date: string) => string
    /** The short weekday name of a date. */
    readonly dayShort: (date: string) => string
    /** The weekday name and day and month of a date. */
    readonly dayFull: (date: string) => string
    /** The weekday name by index, 0 = Monday. */
    readonly weekdayName: (weekday: number, style: "short" | "long") => string
    /** The range of the week that starts on `monday`. */
    readonly weekRange: (monday: string) => string
    /** A wage or cost in dong. */
    readonly money: (amount: number) => string
    /** Hours from minutes, one decimal. */
    readonly hours: (minutes: number) => string
    /** Every half hour from 05:00 to 24:00. */
    readonly times: ReadonlyArray<ShiftsOption>
    /** The seven weekdays, 0 = Monday. */
    readonly weekdays: ReadonlyArray<ShiftsOption>
    /** `days` dates from `from` on, as select choices. */
    readonly dates: (from: string, days: number) => ReadonlyArray<ShiftsOption>
}

/** Builds the half-hour choices; the last one stands for the end of the day. */
const halfHours = (): Array<ShiftsOption> => {
    const out: Array<ShiftsOption> = []
    for (let minute = OPENING_FROM_HOUR * 60; minute <= MIDNIGHT * 60; minute += HALF_HOUR) {
        const clock = `${String(Math.floor(minute / 60) % MIDNIGHT).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
        const isEnd = minute === MIDNIGHT * 60
        out.push({ id: isEnd ? "23:59" : clock, label: isEnd ? "24:00" : clock })
    }
    return out
}

const TIMES = halfHours()

/** The date and number formats of the shifts screens, from the reader's locale. */
export const useShiftsFormat = (): ShiftsFormat => {
    const format = useFormatter()
    return useMemo(() => {
        const utc = (date: string): Date => new Date(`${date}T00:00:00Z`)
        const dayMonth = (date: string): string =>
            format.dateTime(utc(date), { day: "2-digit", month: "2-digit", timeZone: "UTC" })
        const dayShort = (date: string): string => format.dateTime(utc(date), { weekday: "short", timeZone: "UTC" })
        const weekdayName = (weekday: number, style: "short" | "long"): string =>
            format.dateTime(utc(isoAddDays(REFERENCE_MONDAY, weekday)), { weekday: style, timeZone: "UTC" })
        const dayFull = (date: string): string => `${weekdayName(isoWeekdayIndex(date), "long")} ${dayMonth(date)}`
        return {
            dayMonth,
            dayShort,
            dayFull,
            weekdayName,
            weekRange: (monday) =>
                format.dateTimeRange(utc(monday), utc(isoAddDays(monday, 6)), {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    timeZone: "UTC",
                }),
            money: (amount) => format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
            hours: (minutes) =>
                format.number(Math.round(minutes / 6) / 10, {
                    style: "unit",
                    unit: "hour",
                    unitDisplay: "narrow",
                    maximumFractionDigits: 1,
                }),
            times: TIMES,
            weekdays: Array.from({ length: 7 }, (_, index) => ({
                id: String(index),
                label: weekdayName(index, "long"),
            })),
            dates: (from, days) =>
                Array.from({ length: days }, (_, index) => {
                    const date = isoAddDays(from, index)
                    return { id: date, label: dayFull(date) }
                }),
        }
    }, [format])
}
