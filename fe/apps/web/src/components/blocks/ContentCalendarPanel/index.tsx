"use client"

import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import {
    moveToDay,
    pad2,
    shiftMonth,
    useContentCommand,
    useContentFocus,
    vietnamClock,
    vnDateKey,
    postView,
    useContentItemActions,
    useContentData,
} from "@/hooks/content"
import { calendarMonthView } from "@/hooks/contentCalendar"
import { ContentCalendarPanelBase } from "./component"

/** The Calendar tab: month grid with drag to reschedule, agenda on phones, and the posts without a date. */
/** Connects the state and commands used by ContentCalendarPanel. */
/** Inputs for the connected state mapping. */
interface BuildContentCalendarPanelStateInput {
    readonly ym: CalendarMonth
    readonly data: ReturnType<typeof useContentData>
    readonly t: ReturnType<typeof useTranslations<"content">>
    readonly dragId: string | null
    readonly setDragId: import("react").Dispatch<import("react").SetStateAction<string | null>>
    readonly setOverKey: import("react").Dispatch<import("react").SetStateAction<string | null>>
    readonly command: ReturnType<typeof useContentCommand>
    readonly actions: ReturnType<typeof useContentItemActions>
    readonly now: Date
    readonly overKey: string | null
    readonly expandedKey: string | null
    readonly setYm: import("react").Dispatch<import("react").SetStateAction<CalendarMonth>>
    readonly focus: ReturnType<typeof useContentFocus>
    readonly setExpandedKey: import("react").Dispatch<import("react").SetStateAction<string | null>>
}

/** Derives display values and interactions from the supplied state. */
const buildContentCalendarPanelState = ({
    ym,
    data,
    t,
    dragId,
    setDragId,
    setOverKey,
    command,
    actions,
    now,
    overKey,
    expandedKey,
    setYm,
    focus,
    setExpandedKey,
}: BuildContentCalendarPanelStateInput) => {
    const { y, m } = ym
    const { monthItems, pillarNames, byDay, cells } = calendarMonthView(data, t, y, m)
    const hasSetup = data.pillars.some((p) => p.active) && data.cadence.some((c) => c.posts_per_week > 0)
    const drop = (day: number) => {
        const item = data.items.find((i) => i.id === dragId)
        setDragId(null)
        setOverKey(null)
        if (!data.canManage || item === undefined || item.status === "published") return
        const at = moveToDay(item.scheduled_at, y, m, day)
        if (at !== item.scheduled_at) command.run("move", () => actions.move(item.id, at))
    }
    return {
        t,
        y,
        m,
        cells,
        byDay,
        monthItems,
        pillarNames,
        data,
        now,
        dragId,
        overKey,
        expandedKey,
        hasSetup,
        command,
        setYm,
        focus,
        setDragId,
        setOverKey,
        drop,
        setExpandedKey,
    }
}

/** Draws the connected view from its current state. */
export const ContentCalendarPanel = () => {
    const data = useContentData()
    const t = useTranslations("content")
    const command = useContentCommand()
    const actions = useContentItemActions()
    const focus = useContentFocus()
    const now = useMemo(() => new Date(data.nowIso), [data.nowIso])
    const [ym, setYm] = useState(() => {
        const here = vietnamClock(now)
        return { y: here.y, m: here.m }
    })
    const [dragId, setDragId] = useState<string | null>(null)
    const [overKey, setOverKey] = useState<string | null>(null)
    const [expandedKey, setExpandedKey] = useState<string | null>(null)

    const connected = buildContentCalendarPanelState({
        ym,
        data,
        t,
        dragId,
        setDragId,
        setOverKey,
        command,
        actions,
        now,
        overKey,
        expandedKey,
        setYm,
        focus,
        setExpandedKey,
    })
    if (connected === null) return null
    const { y, m, cells, byDay, monthItems, pillarNames, hasSetup, drop } = connected
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
                pickedId: dragId,
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
                pick: (id) => {
                    setDragId((current) => (current === id ? null : id))
                    setOverKey(null)
                },
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

/** The year and month selected in the content calendar. */
type CalendarMonth = Pick<ReturnType<typeof vietnamClock>, "y" | "m">
