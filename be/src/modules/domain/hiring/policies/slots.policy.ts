import type { AvailabilityWindow, Slot } from "../hiring.contracts"
import { addDays, vnInstant, vnClockParts } from "./vn-time.policy"

const MINUTES_PER_HOUR = 60
const STEP_MIN = 30
const MIN_LEAD_HOURS = 2
const MS_PER_MIN = 60_000
const HOUR_MS = 3_600_000
const DEFAULT_START = 9
const DEFAULT_END = 17
const ROUNDS = 3

/** The window a member has until they declare their own: Monday to Friday, nine to five. */
export const DEFAULT_WINDOWS: ReadonlyArray<AvailabilityWindow> = [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    startMin: DEFAULT_START * MINUTES_PER_HOUR,
    endMin: DEFAULT_END * MINUTES_PER_HOUR,
}))

/** The start times of one Vietnam day that fit a window, are far enough ahead and do not meet a busy time. */
const daySlots = (
    windows: ReadonlyArray<AvailabilityWindow>,
    busy: ReadonlyArray<readonly [number, number]>,
    durationMin: number,
    day: Date,
    earliest: number,
): Array<Slot> => {
    const parts = vnClockParts(day)
    return windows
        .filter((window) => window.weekday === parts.weekday)
        .flatMap((window) => {
            const starts: Array<number> = []
            for (let minute = window.startMin; minute + durationMin <= window.endMin; minute += STEP_MIN)
                starts.push(minute)
            return starts
        })
        .map((minute) => vnInstant(parts.year, parts.month, parts.day, minute))
        .map((start): Slot => ({
            start: start.toISOString(),
            end: new Date(start.getTime() + durationMin * MS_PER_MIN).toISOString(),
        }))
        .filter((slot) => {
            const start = Date.parse(slot.start)
            const end = Date.parse(slot.end)
            return start >= earliest && !busy.some(([from, to]) => start < to && end > from)
        })
}

/**
 * Up to `count` interview times in the next `horizonDays` days: the earliest free time of each day first, then later ones, spread over
 * the days. Times are on the Vietnam clock; a time under two hours away is never offered.
 */
export const computeSlots = (
    windows: ReadonlyArray<AvailabilityWindow>,
    busy: ReadonlyArray<Slot>,
    durationMin: number,
    now: Date,
    count = 3,
    horizonDays = 14,
): Array<Slot> => {
    const busyMs = busy.map((slot): readonly [number, number] => [Date.parse(slot.start), Date.parse(slot.end)])
    const earliest = now.getTime() + MIN_LEAD_HOURS * HOUR_MS
    const days = Array.from({ length: horizonDays + 1 }, (_, offset) =>
        daySlots(windows, busyMs, durationMin, addDays(now, offset), earliest),
    ).filter((list) => list.length > 0)
    const picked: Array<Slot> = []
    for (let round = 0; picked.length < count && round < ROUNDS; round += 1) {
        for (const list of days) {
            const index = round === 0 ? 0 : Math.min(list.length - 1, Math.floor(list.length / (round + 1)))
            const slot = list[index]
            if (slot !== undefined && !picked.some((other) => other.start === slot.start) && picked.length < count)
                picked.push(slot)
        }
    }
    return picked.sort((a, b) => a.start.localeCompare(b.start))
}
