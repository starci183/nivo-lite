import type { ContentViews } from "@/modules/types"
import type { ContentWorkbenchData } from "@/modules/content"
import { parseDate } from "@internationalized/date"
import type { useFormatter, useTranslations } from "next-intl"
import { calendarMonthView } from "@/hooks/contentCalendar"
import { postView, vietnamClock, vnDateKey } from "@/hooks/content"
import { PRODUCT_TIME_ZONE } from "@/modules/i18n"

/** Current content data and the actual conditional lifetime of one module surface. */
export interface ContentViewInput {
    readonly data: ContentWorkbenchData | undefined
    readonly workspaceId: string | undefined
    readonly startedAt: string
    readonly copy: ContentViews["workbenchCopy"]
    readonly isActive: boolean
    readonly isReady: boolean
    readonly scope: string
    readonly focus: string | null
}

/** The active tab scopes controller state to the surface that owns it. */
export interface ContentSelectedViewInput extends ContentViewInput {
    readonly selected: ContentViews["tab"]
}

/** Keeps the existing form/root/row error precedence in the actual settings controller. */
export const contentSettingsError = (
    errors: { readonly message?: string; readonly root?: { readonly message?: string } } | undefined,
    rowMessage: string | undefined,
    invalidLabel: string,
) => errors?.message ?? errors?.root?.message ?? rowMessage ?? (errors ? invalidLabel : undefined)

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
export const freshContentCalendar = (
    input: Pick<ContentViewInput, "scope" | "isActive" | "isReady">,
    now: Date,
    epoch: number,
): ContentCalendarState => {
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
export const sameContentCalendarOwner = (
    current: ContentCalendarState,
    input: Pick<ContentViewInput, "scope" | "isActive" | "isReady">,
) => current.scope === input.scope && current.isActive === input.isActive && current.isReady === input.isReady

/** Captured events can affect only the exact active, ready activation that produced them. */
export const currentContentCalendarEpoch = (current: ContentCalendarReceipt, expected: ContentCalendarReceipt) =>
    current.scope === expected.scope &&
    current.epoch === expected.epoch &&
    current.isActive === expected.isActive &&
    current.isReady === expected.isReady &&
    current.isActive &&
    current.isReady

const CONTENT_CALENDAR_MAX_CHIPS = 3

interface ContentCalendarFieldsInput {
    data: NonNullable<ContentViewInput["data"]>
    t: ReturnType<typeof useTranslations<"content">>
    format: ReturnType<typeof useFormatter>
    ym: ContentCalendarState["ym"]
    now: Date
    expandedKey: string | null
}

/** Resolve the month cells and post labels from the current read and selection. */
export const contentCalendarFields = (input: ContentCalendarFieldsInput) => {
    const { data, t, format, ym, now, expandedKey } = input
    const { monthItems, pillarNames, byDay, cells } = calendarMonthView(data, t, ym.y, ym.m)
    const resolvedCells = cells.map((cell) => {
        const list = byDay.get(cell.dateKey) ?? []
        const shown = expandedKey === cell.dateKey ? list : list.slice(0, CONTENT_CALENDAR_MAX_CHIPS)
        return {
            ...cell,
            label:
                cell.day === null
                    ? ""
                    : format.dateTime(parseDate(cell.dateKey).toDate(PRODUCT_TIME_ZONE), {
                          dateStyle: "full",
                          timeZone: PRODUCT_TIME_ZONE,
                      }) + (cell.dateKey === vnDateKey(now) ? " · " + t("today") : ""),
            posts: shown.map((post) => ({ ...post, pickLabel: t("calendarPickMove") + ": " + post.title })),
            moreLabel:
                list.length > CONTENT_CALENDAR_MAX_CHIPS && expandedKey !== cell.dateKey
                    ? t("moreItems", { n: list.length - CONTENT_CALENDAR_MAX_CHIPS })
                    : null,
        }
    })
    return {
        cells: resolvedCells,
        monthItems: monthItems.map((item) => postView(t, item, pillarNames)),
        unscheduled: data.items
            .filter((item) => item.scheduled_at === null && item.status !== "skipped" && item.status !== "published")
            .map((item) => postView(t, item, pillarNames)),
        hasSetup: data.pillars.some((p) => p.active) && data.cadence.some((c) => c.posts_per_week > 0),
    }
}
