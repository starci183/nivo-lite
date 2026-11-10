/**
 * The weekly working hours of an agent: seven days (Monday first), each a row of half-hour slots from 06:00 to 23:00. A slot is on
 * when the agent is on duty then. The hours list reads the slots back as "from - to" ranges per day.
 *
 * The stored text is JSON of the ranges per day, the shape the back end setting `workingHours` holds:
 * `{"v":1,"afterHours":true,"days":[[["08:00","20:00"]],...]}`.
 */

/** The first minute of the grid (06:00). */
export const HOURS_START_MIN: number = 6 * 60

/** The minute the grid ends at (23:00, exclusive). */
export const HOURS_END_MIN: number = 23 * 60

/** The length of one slot in minutes. */
export const SLOT_MIN: number = 30

/** How many slots a day has. */
export const SLOTS_PER_DAY: number = (HOURS_END_MIN - HOURS_START_MIN) / SLOT_MIN

/** The days of the week, Monday first. */
const WEEK_DAYS: number = 7

/** One day: a flag per slot, true while on duty. */
type DaySlots = ReadonlyArray<boolean>

/** A week: seven days. */
export type WeekSlots = ReadonlyArray<DaySlots>

/** One stretch of duty in a day, in minutes since midnight; `end` is exclusive. */
interface HourRange {
    readonly start: number
    readonly end: number
}

/** The hours and the answer-after-hours choice, saved together. */
export interface WorkingHours {
    readonly week: WeekSlots
    readonly afterHours: boolean
}

/** "HH:mm" of a minute count. */
export const clockOf = (minutes: number): string =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`

/** The minute count of "HH:mm"; null when the text is not a clock time. */
export const minutesOf = (clock: string): number | null => {
    const match = /^(\d{1,2}):(\d{2})$/u.exec(clock.trim())
    if (match === null) return null
    const [hours, minutes] = [Number(match[1]), Number(match[2])]
    return hours < 24 && minutes < 60 ? hours * 60 + minutes : null
}

/** The first minute of one slot. */
const slotStart = (slot: number): number => HOURS_START_MIN + slot * SLOT_MIN

const emptyDay = (): Array<boolean> => Array.from({ length: SLOTS_PER_DAY }, () => false)

/** A week with nobody on duty. */
const emptyWeek = (): WeekSlots => Array.from({ length: WEEK_DAYS }, emptyDay)

/** The ranges of one day, merged and in order. */
export const rangesOf = (day: DaySlots): ReadonlyArray<HourRange> => {
    const ranges: Array<HourRange> = []
    let from: number | null = null
    day.forEach((on, slot) => {
        if (on && from === null) from = slot
        if (!on && from !== null) {
            ranges.push({ start: slotStart(from), end: slotStart(slot) })
            from = null
        }
    })
    if (from !== null) ranges.push({ start: slotStart(from), end: HOURS_END_MIN })
    return ranges
}

/** The slots of ranges: each range is clipped to the grid and rounded outward to the slot it touches. */
const slotsOf = (ranges: ReadonlyArray<HourRange>): DaySlots => {
    const day = emptyDay()
    ranges.forEach((range) => {
        const first = Math.max(0, Math.floor((range.start - HOURS_START_MIN) / SLOT_MIN))
        const last = Math.min(SLOTS_PER_DAY, Math.ceil((range.end - HOURS_START_MIN) / SLOT_MIN))
        for (let slot = first; slot < last; slot += 1) day[slot] = true
    })
    return day
}

/** A week with one range on a run of days (Monday is day 0). */
const spread = (week: Array<DaySlots>, days: ReadonlyArray<number>, start: number, end: number): void => {
    days.forEach((day) => {
        week[day] = slotsOf([{ start, end }])
    })
}

/** What a new agent starts with: Monday to Friday 08:00-20:00, Saturday 08:00-17:00, Sunday 09:00-12:00. */
export const defaultHours = (): WorkingHours => {
    const week: Array<DaySlots> = [...emptyWeek()]
    spread(week, [0, 1, 2, 3, 4], 8 * 60, 20 * 60)
    spread(week, [5], 8 * 60, 17 * 60)
    spread(week, [6], 9 * 60, 12 * 60)
    return { week, afterHours: true }
}

/** The same hours, one day replaced by the slots of its ranges. */
export const withDayRanges = (week: WeekSlots, day: number, ranges: ReadonlyArray<HourRange>): WeekSlots =>
    week.map((slots, index) => (index === day ? slotsOf(ranges) : slots))

/** Whether two weeks hold the same slots. */
export const sameWeek = (left: WeekSlots, right: WeekSlots): boolean =>
    left.every((day, index) => day.every((on, slot) => on === right[index]?.[slot]))

/** The text a store keeps. */
export const serialiseHours = (hours: WorkingHours): string =>
    JSON.stringify({
        v: 1,
        afterHours: hours.afterHours,
        days: hours.week.map((day) => rangesOf(day).map((range) => [clockOf(range.start), clockOf(range.end)])),
    })

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The hours of a stored text; null when it is not the saved shape (the caller then starts from the default). */
export const parseHours = (text: string | null): WorkingHours | null => {
    if (text === null) return null
    try {
        const raw: unknown = JSON.parse(text)
        if (!isRecord(raw) || !Array.isArray(raw.days) || raw.days.length !== WEEK_DAYS) return null
        const week = raw.days.map((day: unknown): DaySlots => {
            const ranges: Array<HourRange> = []
            if (Array.isArray(day)) {
                day.forEach((pair: unknown) => {
                    if (!Array.isArray(pair)) return
                    const start = minutesOf(String(pair[0]))
                    const end = minutesOf(String(pair[1]))
                    if (start !== null && end !== null && end > start) ranges.push({ start, end })
                })
            }
            return slotsOf(ranges)
        })
        return { week, afterHours: raw.afterHours !== false }
    } catch {
        return null
    }
}

