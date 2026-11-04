import type { useTranslations } from "next-intl"
import { daysInMonth, isoWeekdayOf, pad2, postView, vietnamClock, vnDateKey } from "@/hooks/content"
import type { ContentWorkbenchData, ContentItem } from "@/modules/content"
import type { PostView } from "@/modules/types"

const inMonth = (iso: string | null, y: number, m: number): boolean => {
    if (iso === null) return false
    const p = vietnamClock(new Date(iso))
    return p.y === y && p.m === m
}

const WEEK = 7

/** What `calendarMonthView` returns. */
export interface CalendarMonthViewResult {
    monthItems: ContentItem[]
    pillarNames: {
        [k: string]: string
    }
    byDay: Map<string, PostView[]>
    cells: (
        | {
              key: string
              day: number
              dateKey: string
          }
        | {
              key: string
              day: null
              dateKey: string
          }
    )[]
}

/** Groups a month's scheduled posts and constructs its complete week cells. */
export const calendarMonthView = (
    data: ContentWorkbenchData,
    t: ReturnType<typeof useTranslations<"content">>,
    y: number,
    m: number,
): CalendarMonthViewResult => {
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

/** Who owns a calendar: the scope and the activation of the surface that shows it. */
export interface ContentCalendarOwner {
    readonly scope: string
    readonly isActive: boolean
    readonly isReady: boolean
}

/** One immutable calendar owner and its actual local selection/drag state. */
export interface ContentCalendarState {
    readonly scope: string
    readonly isActive: boolean
    readonly isReady: boolean
    readonly epoch: number
    readonly ym: { readonly y: number; readonly m: number }
    readonly dragId: string | null
    readonly overKey: string | null
    readonly expandedKey: string | null
}

/** A commit receipt carries the immutable bundle's identity, never a second source of UI values. */
export type ContentCalendarReceipt = Pick<ContentCalendarState, "scope" | "isActive" | "isReady" | "epoch">

/** Fresh activation uses the incoming source's real month and the original empty drag/expansion defaults. */
export const freshContentCalendar = (input: ContentCalendarOwner, now: Date, epoch: number): ContentCalendarState => {
    const here = vietnamClock(now)
    return {
        scope: input.scope,
        isActive: input.isActive,
        isReady: input.isReady,
        epoch,
        ym: { y: here.y, m: here.m },
        dragId: null,
        overKey: null,
        expandedKey: null,
    }
}

/** Background data identity does not own a user's selected month. */
export const sameContentCalendarOwner = (current: ContentCalendarState, input: ContentCalendarOwner): boolean =>
    current.scope === input.scope && current.isActive === input.isActive && current.isReady === input.isReady

/** Captured events can affect only the exact active, ready activation that produced them. */
export const currentContentCalendarEpoch = (
    current: ContentCalendarReceipt,
    expected: ContentCalendarReceipt,
): boolean =>
    current.scope === expected.scope &&
    current.epoch === expected.epoch &&
    current.isActive === expected.isActive &&
    current.isReady === expected.isReady &&
    current.isActive &&
    current.isReady
