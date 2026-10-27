import type { useTranslations } from "next-intl"
import {
    daysInMonth,
    isoWeekdayOf,
    pad2,
    postView,
    vietnamClock,
    vnDateKey,
    type useContentData,
} from "@/hooks/content"
import type { PostView } from "@/modules/types"

const inMonth = (iso: string | null, y: number, m: number): boolean => {
    if (iso === null) return false
    const p = vietnamClock(new Date(iso))
    return p.y === y && p.m === m
}

const WEEK = 7

/** Groups a month's scheduled posts and constructs its complete week cells. */
export const calendarMonthView = (
    data: ReturnType<typeof useContentData>,
    t: ReturnType<typeof useTranslations<"content">>,
    y: number,
    m: number,
) => {
    const monthItems = data.items
        .filter((i) => inMonth(i.scheduled_at, y, m))
        .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))
    const pillarNames = Object.fromEntries(data.pillars.map((p) => [p.id, p.name]))
    const byDay = new Map<string, Array<PostView>>()
    for (const item of monthItems) {
        const key = vnDateKey(new Date(item.scheduled_at ?? ""))
        byDay.set(key, [...(byDay.get(key) ?? []), postView(t, item, pillarNames)])
    }
    const lead = isoWeekdayOf(y, m, 1) - 1
    const days = daysInMonth(y, m)
    const total = Math.ceil((lead + days) / WEEK) * WEEK
    const cells = Array.from({ length: total }, (_, i) => {
        const day = i - lead + 1
        return day >= 1 && day <= days
            ? { key: `d${day}`, day, dateKey: `${y}-${pad2(m)}-${pad2(day)}` }
            : { key: `x${i}`, day: null, dateKey: "" }
    })
    return { monthItems, pillarNames, byDay, cells }
}
