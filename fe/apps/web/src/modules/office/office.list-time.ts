import { threadDayKey } from "./office.thread"
import type { OfficeWords } from "./office.words"

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/** Past this many days the time is a date. */
const DAYS_SHOWN = 7

const dayIndexOf = (iso: string): number => Math.floor(Date.parse(threadDayKey(iso)) / DAY_MS)

/** "dd/MM" of a moment, in product time. */
const shortDateOf = (iso: string): string => {
    const key = threadDayKey(iso)
    return `${key.slice(8, 10)}/${key.slice(5, 7)}`
}

/**
 * The time of a conversation row as Zalo draws it: "Just now", "N min", "N h", "Yesterday", "N days", then dd/MM.
 * A moment in the future (a clock that runs ahead) reads as just now.
 */
export const zaloTimeOf = (iso: string, nowIso: string, words: OfficeWords): string => {
    const ago = Date.parse(nowIso) - Date.parse(iso)
    if (ago < MINUTE_MS) return words.t("listTimeNow")
    if (ago < HOUR_MS) return words.t("listTimeMinutes", { n: Math.floor(ago / MINUTE_MS) })
    if (ago < DAY_MS) return words.t("listTimeHours", { n: Math.floor(ago / HOUR_MS) })
    const days = dayIndexOf(nowIso) - dayIndexOf(iso)
    if (days <= 1) return words.t("yesterday")
    return days < DAYS_SHOWN ? words.t("listTimeDays", { n: days }) : shortDateOf(iso)
}
