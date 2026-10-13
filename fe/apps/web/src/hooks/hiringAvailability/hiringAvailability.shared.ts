import type { HiringMemberView } from "@/hooks/hiringWire"
import type { HiringAvailabilityWindowRequest } from "@/modules/api"
import { wallClockText } from "@/modules/i18n"

/** The weekdays of the availability form, Monday first (0 is Sunday). */
export const WEEKDAYS: ReadonlyArray<number> = [1, 2, 3, 4, 5, 6, 0]

const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR

/** The minutes after midnight of "9", "9:30" or "9h30"; null when the text is not a time. */
const minutesOf = (text: string): number | null => {
    const match = /^(\d{1,2})(?:[:h](\d{2})?)?$/.exec(text.trim())
    if (match === null) return null
    const minutes = Number(match[1]) * MINUTES_PER_HOUR + Number(match[2] ?? 0)
    return Number(match[1]) <= 24 && Number(match[2] ?? 0) < MINUTES_PER_HOUR && minutes <= MINUTES_PER_DAY
        ? minutes
        : null
}

/** "09:00-12:00, 14:00-17:00" as windows of a weekday; null when a part is not a time range. */
export const parseWindows = (weekday: number, text: string): Array<HiringAvailabilityWindowRequest> | null => {
    const windows: Array<HiringAvailabilityWindowRequest> = []
    for (const part of text
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry !== "")) {
        const [from, to] = part.split(/\s*-\s*/)
        const startMin = minutesOf(from ?? "")
        const endMin = minutesOf(to ?? "")
        if (startMin === null || endMin === null || endMin <= startMin) return null
        windows.push({ weekday, startMin, endMin })
    }
    return windows
}

/** The text of one weekday of a member: "09:00-12:00, 14:00-17:00". */
const dayText = (member: HiringMemberView, weekday: number): string =>
    member.windows
        .filter((window) => window.weekday === weekday)
        .sort((a, b) => a.startMin - b.startMin)
        .map((window) => `${wallClockText(window.startMin)}-${wallClockText(window.endMin)}`)
        .join(", ")

/** The form texts of a member, one per weekday (empty for nobody). */
export const memberTexts = (member: HiringMemberView | undefined): Record<number, string> =>
    Object.fromEntries(WEEKDAYS.map((weekday) => [weekday, member === undefined ? "" : dayText(member, weekday)]))
