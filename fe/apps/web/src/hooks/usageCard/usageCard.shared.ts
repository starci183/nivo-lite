import type { useFormatter, useTranslations } from "next-intl"
import type { CreditUsageSummaryType } from "@/hooks/swr"
import { dayjs } from "@/modules/dayjs"
import type { DataSlot } from "@/modules/types"

type UsageTranslator = ReturnType<typeof useTranslations<"billing">>
type UsageFormatter = ReturnType<typeof useFormatter>
type MeterTone = "informative" | "cautionary" | "negative"
type UsageStatus = NonNullable<CreditUsageSummaryType["status"]>

interface UsageMeter {
    readonly id: string
    readonly label: string
    readonly value: number
    readonly maximum: number
    readonly reading: string
    readonly tone: MeterTone
}

interface UsageFact {
    readonly id: string
    readonly term: string
    readonly value: string
}

interface UsageDaily {
    readonly title: string
    readonly accessibleLabel: string
    readonly creditsLabel: string
    readonly firstDay: string
    readonly lastDay: string
    readonly maximum: number
    readonly series: ReadonlyArray<{ readonly day: string; readonly credits: number }>
}

/** The settled words and figures of the usage card. */
export interface UsageCardData {
    readonly title: string
    readonly description: string
    readonly loading: string
    readonly empty: string
    readonly modulesTitle: string
    readonly alert: {
        readonly tone: "negative" | "cautionary"
        readonly title: string
        readonly actionLabel: string
    } | null
    readonly meters: ReadonlyArray<UsageMeter>
    readonly facts: ReadonlyArray<UsageFact>
    readonly modules: ReadonlyArray<{ readonly id: string; readonly label: string; readonly reading: string }>
    readonly daily: UsageDaily | null
}

/** The usage read as a slot, the card's placeholder (its words with no figures) and the callbacks supplied to the pure card. */
export interface UsageCardView {
    readonly slot: DataSlot<UsageCardData>
    readonly placeholder: UsageCardData
    readonly on: {
        readonly openCredits: () => void
        readonly retry: () => void
        readonly formatDay: (value: unknown) => string
        readonly formatCredits: (value: unknown) => string
        readonly minimumBarSize: (value: number | null | undefined) => number
    }
}

const WARNING_RATIO = 0.8

const toneOf = (used: number, limit: number | null): MeterTone => {
    if (limit === null || limit <= 0) return "informative"
    if (used >= limit) return "negative"
    if (used / limit >= WARNING_RATIO) return "cautionary"
    return "informative"
}

const readingOf = (used: number, limit: number | null, t: UsageTranslator, format: UsageFormatter): string => {
    if (limit === null) return t("usageUnlimited", { used: format.number(used) })
    return t("usageOf", { used: format.number(used), limit: format.number(limit) })
}

/** Prepares the allowance meters with localized readings. */
export const metersOf = (
    status: UsageStatus | null,
    t: UsageTranslator,
    format: UsageFormatter,
): ReadonlyArray<UsageMeter> => {
    if (!status) return []
    const limit = status.creditsLimit ?? null
    const meters: UsageMeter[] = [
        {
            id: "credits",
            label: t("usageCredits"),
            value: limit === null ? 0 : Math.min(status.creditsUsed, limit),
            maximum: limit ?? 1,
            reading: readingOf(Math.round(status.creditsUsed), limit, t, format),
            tone: toneOf(status.creditsUsed, limit),
        },
    ]
    if (status.messagesLimit !== null) {
        meters.push({
            id: "messages",
            label: t("usageMessages"),
            value: Math.min(status.messagesUsed, status.messagesLimit),
            maximum: status.messagesLimit,
            reading: readingOf(status.messagesUsed, status.messagesLimit, t, format),
            tone: toneOf(status.messagesUsed, status.messagesLimit),
        })
    }
    return meters
}

/** Prepares remaining credits, rollover and the allowance month. */
export const factsOf = (
    status: UsageStatus | null,
    t: UsageTranslator,
    format: UsageFormatter,
): ReadonlyArray<UsageFact> => {
    if (!status) return []
    const limit = status.creditsLimit ?? null
    const facts: UsageFact[] = [
        {
            id: "left",
            term: t("usageCreditsLeft"),
            value:
                limit === null ? t("usageNoLimit") : format.number(Math.round(Math.max(0, limit - status.creditsUsed))),
        },
    ]
    if (status.creditsCarried > 0) {
        facts.push({ id: "carried", term: t("usageCarried"), value: format.number(Math.round(status.creditsCarried)) })
    }
    facts.push({
        id: "period",
        term: t("usagePeriod"),
        value: format.dateTime(dayjs.utc(status.periodStart).toDate(), {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
        }),
    })
    return facts
}

/** Prepares the current allowance warning, when the backend reports one. */
export const alertOf = (status: UsageStatus | null, t: UsageTranslator): UsageCardData["alert"] => {
    if (status?.level === "exceeded")
        return { tone: "negative", title: t("usageExceeded"), actionLabel: t("usageOpenCredits") }
    if (status?.level === "warn") {
        return {
            tone: "cautionary",
            title: t("usageWarn", { pct: Math.round(status.ratio * 100) }),
            actionLabel: t("usageOpenCredits"),
        }
    }
    return null
}

const daysOf = (from: string, to: string): ReadonlyArray<string> => {
    const days: string[] = []
    let current = dayjs.utc(from)
    const last = dayjs.utc(to)
    while (current.valueOf() <= last.valueOf() && days.length < 32) {
        days.push(current.format("YYYY-MM-DD"))
        current = current.add(1, "day")
    }
    return days
}

/** Prepares daily credits for the active allowance period through the supplied calendar day. */
export const dailyOf = (
    usage: CreditUsageSummaryType | undefined,
    t: UsageTranslator,
    format: UsageFormatter,
    today: string,
): UsageDaily | null => {
    if (!usage?.status) return null
    const days = daysOf(usage.status.periodStart, today)
    if (!days.length) return null
    const byDay = new Map(usage.daily.map((day) => [day.day, day.credits]))
    const series = days.map((day) => ({ day, credits: byDay.get(day) ?? 0 }))
    const maximum = Math.max(1, ...series.map((day) => day.credits))
    return {
        title: t("usageDaily"),
        accessibleLabel: t("usageDailyLabel", { peak: format.number(Math.round(maximum)) }),
        creditsLabel: t("usageCredits"),
        maximum,
        series,
        firstDay: days[0]?.slice(8) ?? "",
        lastDay: days.at(-1)?.slice(8) ?? "",
    }
}
