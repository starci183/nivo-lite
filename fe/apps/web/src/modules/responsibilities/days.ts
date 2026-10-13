import { createFormatter } from "next-intl"
import { TIME_ZONE } from "@/i18n/core"
import type { RespT } from "./rows"

const DAY_MS = 86_400_000

const dayFormatter = createFormatter({ locale: "en-CA", timeZone: TIME_ZONE })

/** Calendar day in the workspace time zone, as UTC midnight milliseconds. */
const dayStart = (date: Date): number => {
    const [y, m, d] = dayFormatter
        .dateTime(date, { year: "numeric", month: "2-digit", day: "2-digit" })
        .split("-")
        .map(Number)
    return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)
}

/** Whole calendar days from `now` to the due moment (negative once it is past). */
export const dayOffset = (due: string, now: Date): number =>
    Math.round((dayStart(new Date(due)) - dayStart(now)) / DAY_MS)

/** The due wording of a day offset. */
export const dueText = (t: RespT, offset: number): string => {
    if (offset < -1) return t("overdueDays", { n: -offset })
    if (offset === -1) return t("overdueYesterday")
    if (offset === 0) return t("dueToday")
    if (offset === 1) return t("dueTomorrow")
    return t("dueInDays", { n: offset })
}
