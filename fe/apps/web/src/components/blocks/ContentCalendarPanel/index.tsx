"use client"

import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import {
    daysInMonth,
    isoWeekdayOf,
    moveToDay,
    pad2,
    shiftMonth,
    useContentCommand,
    useContentFocus,
    vietnamClock,
    vnDateKey,
    postView,
    type PostView,
    type ContentWorkbenchData,
} from "@/hooks/content"
import { writeMoveItem } from "@/modules/db/content/write-items"
import { ContentCalendarPanelBase } from "./component"

/** Props of {@link ContentCalendarPanel}. */
export interface ContentCalendarPanelProps {
    /** What the workbench read for the member. */
    readonly data: ContentWorkbenchData
}

const inMonth = (iso: string | null, y: number, m: number): boolean => {
    if (iso === null) return false
    const p = vietnamClock(new Date(iso))
    return p.y === y && p.m === m
}

const WEEK = 7

/** The Calendar tab: month grid with drag to reschedule, agenda on phones, and the posts without a date. */
export const ContentCalendarPanel = (props: ContentCalendarPanelProps) => {
    const t = useTranslations("content")
    const command = useContentCommand()
    const focus = useContentFocus()
    const { data } = props
    const now = useMemo(() => new Date(data.nowIso), [data.nowIso])
    const [ym, setYm] = useState(() => {
        const here = vietnamClock(now)
        return { y: here.y, m: here.m }
    })
    const [dragId, setDragId] = useState<string | null>(null)
    const [overKey, setOverKey] = useState<string | null>(null)
    const [expandedKey, setExpandedKey] = useState<string | null>(null)
    const { y, m } = ym
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
    const hasSetup = data.pillars.some((p) => p.active) && data.cadence.some((c) => c.posts_per_week > 0)
    const drop = (day: number) => {
        const item = data.items.find((i) => i.id === dragId)
        setDragId(null)
        setOverKey(null)
        if (!data.canManage || item === undefined || item.status === "published") return
        const at = moveToDay(item.scheduled_at, y, m, day)
        if (at !== item.scheduled_at) command.run("move", () => writeMoveItem(item.id, at))
    }
    return (
        <ContentCalendarPanelBase
            props={{
                t,
                y,
                m,
                title: t("monthTitle", { m: pad2(m), y }),
                cells,
                byDay,
                monthItems: monthItems.map((i) => postView(t, i, pillarNames)),
                unscheduled: data.items
                    .filter((i) => i.scheduled_at === null && i.status !== "skipped" && i.status !== "published")
                    .map((i) => postView(t, i, pillarNames)),
                todayKey: vnDateKey(now),
                isDragging: dragId !== null,
                overKey,
                expandedKey,
                canManage: data.canManage,
                isEmptySetup: !hasSetup && data.items.length === 0,
                note: command.note,
            }}
            on={{
                shift: (by) => setYm((cur) => shiftMonth(cur.y, cur.m, by)),
                today: () => {
                    const here = vietnamClock(now)
                    setYm({ y: here.y, m: here.m })
                },
                open: focus.open,
                dragStart: setDragId,
                dragEnd: () => {
                    setDragId(null)
                    setOverKey(null)
                },
                dragOver: setOverKey,
                dragLeave: (key) => setOverKey((cur) => (cur === key ? null : cur)),
                drop,
                expand: setExpandedKey,
                dismissNote: command.dismiss,
            }}
        />
    )
}
