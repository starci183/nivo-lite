"use client"
import { useFormatter, useTranslations } from "next-intl"
import { useLayoutEffect, useRef, useState } from "react"
import {
    moveToDay,
    pad2,
    shiftMonth,
    useContentCommand,
    useContentFocus,
    vietnamClock,
    vnDateKey,
    useContentItemActions,
} from "@/hooks/content"
import {
    contentCalendarFields,
    freshContentCalendar,
    sameContentCalendarOwner,
    currentContentCalendarEpoch,
} from "./contentWorkbench.shared"
import type { ContentViewInput, ContentCalendarState, ContentCalendarReceipt } from "./contentWorkbench.shared"

interface CalendarActionsInput {
    readonly calendar: ContentCalendarState
    readonly now: Date
    readonly data: ContentViewInput["data"]
    readonly command: ReturnType<typeof useContentCommand>
    readonly actions: ReturnType<typeof useContentItemActions>
    readonly focus: ReturnType<typeof useContentFocus>
    readonly isCurrent: () => boolean
    readonly update: (change: (current: ContentCalendarState) => ContentCalendarState) => void
}

/** Browser actions keep their original effects; the committed epoch is checked before any effect starts. */
const calendarActions = (input: CalendarActionsInput) => {
    const { calendar, now, data, command, actions, focus, isCurrent, update } = input
    const drop = (day: number) => {
        if (!isCurrent() || data === undefined) return
        const item = data.items.find((item) => item.id === calendar.dragId)
        update((current) => ({ ...current, dragId: null, overKey: null }))
        if (!data.canManage || item === undefined || item.status === "published") return
        const at = moveToDay(item.scheduled_at, calendar.ym.y, calendar.ym.m, day)
        if (at !== item.scheduled_at) command.run("move", () => actions.move(item.id, at))
    }
    return {
        shift: (by: number) => update((current) => ({ ...current, ym: shiftMonth(current.ym.y, current.ym.m, by) })),
        today: () => {
            const here = vietnamClock(now)
            update((current) => ({ ...current, ym: { y: here.y, m: here.m } }))
        },
        open: (id: string) => {
            if (isCurrent()) focus.open(id)
        },
        dragStart: (id: string) => update((current) => ({ ...current, dragId: id })),
        pick: (id: string) =>
            update((current) => ({ ...current, dragId: current.dragId === id ? null : id, overKey: null })),
        dragEnd: () => update((current) => ({ ...current, dragId: null, overKey: null })),
        dragOver: (key: string) => update((current) => ({ ...current, overKey: key })),
        dragLeave: (key: string) =>
            update((current) => (current.overKey === key ? { ...current, overKey: null } : current)),
        drop,
        expand: (key: string) => update((current) => ({ ...current, expandedKey: key })),
        dismissNote: () => {
            if (isCurrent()) command.dismiss()
        },
    }
}

/**
 * Answers, from an event, whether the calendar that built the handler is the one the browser committed. The receipt is written in
 * a layout effect and read only by the returned check, so no render reads it.
 */
const useCommittedCalendar = (calendar: ContentCalendarState): (() => boolean) => {
    const receipt = useRef<ContentCalendarReceipt | null>(null)
    useLayoutEffect(() => {
        receipt.current = {
            scope: calendar.scope,
            epoch: calendar.epoch,
            isActive: calendar.isActive,
            isReady: calendar.isReady,
        }
        return () => {
            receipt.current = null
        }
    }, [calendar.scope, calendar.epoch, calendar.isActive, calendar.isReady])
    return () => {
        const committed = receipt.current
        return committed !== null && currentContentCalendarEpoch(committed, calendar)
    }
}

/** Projects the incoming owner immediately; only this immutable bundle owns calendar UI state. */
export const useContentCalendarPanelView = (input: ContentViewInput) => {
    const { data } = input
    const t = useTranslations("content")
    const format = useFormatter()
    const command = useContentCommand(input.isActive && input.isReady, input.scope)
    const actions = useContentItemActions()
    const focus = useContentFocus()
    const now = new Date(data?.nowIso ?? input.startedAt)
    const [owned, setOwned] = useState(() => freshContentCalendar(input, now, 0))
    const isOwned = sameContentCalendarOwner(owned, input)
    const calendar = isOwned ? owned : freshContentCalendar(input, now, owned.epoch + 1)
    if (!isOwned) setOwned(calendar)
    const isCurrent = useCommittedCalendar(calendar)
    const update = (change: (current: ContentCalendarState) => ContentCalendarState) => {
        if (!isCurrent()) return
        setOwned((current) => (currentContentCalendarEpoch(current, calendar) ? change(current) : current))
    }
    const fields =
        data === undefined
            ? undefined
            : contentCalendarFields({ data, t, format, ym: calendar.ym, now, expandedKey: calendar.expandedKey })
    return {
        loading: {
            weekdays: t("weekdays").split(","),
            y: calendar.ym.y,
            m: calendar.ym.m,
            title: t("monthTitle", { m: pad2(calendar.ym.m), y: calendar.ym.y }),
            todayKey: vnDateKey(now),
        },
        props:
            data === undefined || fields === undefined
                ? undefined
                : {
                      copy: input.copy,
                      weekdays: t("weekdays").split(","),
                      y: calendar.ym.y,
                      m: calendar.ym.m,
                      title: t("monthTitle", { m: pad2(calendar.ym.m), y: calendar.ym.y }),
                      cells: fields.cells,
                      monthItems: fields.monthItems,
                      isMonthEmpty: fields.monthItems.length === 0,
                      unscheduled: fields.unscheduled,
                      todayKey: vnDateKey(now),
                      pickedId: calendar.dragId,
                      overKey: calendar.overKey,
                      expandedKey: calendar.expandedKey,
                      canManage: data.canManage,
                      isEmptySetup: input.isReady && !fields.hasSetup && data.items.length === 0,
                      note: command.note,
                  },
        on: calendarActions({ calendar, now, data, command, actions, focus, isCurrent, update }),
    }
}
