"use client"

import { useSearchParams } from "next/navigation"
import { useFormatter, useNow, useTranslations } from "next-intl"
import { isWaitingOf, mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQueryWorkspaceDashboardSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import {
    OVERVIEW_PERIODS,
    PERIOD_PARAM,
    overviewCsvOf,
    overviewViewOf,
    periodOfWord,
    periodWordOf,
    rangeOfPeriod,
    type OverviewPeriod,
    type OverviewTools,
} from "@/modules/overview"
import type { DataSlot, OverviewView } from "@/modules/types"
import { PLACEHOLDER_OVERVIEW } from "./overview.shared"

/** The business clock the range of the period is written on. */
const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh"

/** How often the clock of the page ticks, so "2 minutes ago" stays true. */
const CLOCK_TICK_MS = 60_000

/** The view `useOverview` returns. */
export interface OverviewHookView {
    /** The period the page shows. */
    readonly period: OverviewPeriod
    /** The periods the page can switch between, in the order the switch lists them. */
    readonly periods: ReadonlyArray<OverviewPeriod>
    /** The first and last day of the period, written as the page header says them. */
    readonly range: { readonly from: string; readonly to: string }
    /** The figures, worded for the reader, or why there are none yet. */
    readonly slot: DataSlot<OverviewView>
    /** The same figures as a slot would draw while loading. */
    readonly placeholder: OverviewView
    /** The first read has no data yet. */
    readonly isWaiting: boolean
    /** Switches the period; it goes into the address. */
    readonly setPeriod: (period: OverviewPeriod) => void
    /** Reads the figures again. */
    readonly refresh: () => void
    /** Saves the figures on screen as a CSV file. */
    readonly exportReport: () => void
}

/** Writes a text file to the person's device. */
const saveTextFile = (name: string, text: string): void => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
}

/** The overview of the open workspace (read only while `enabled`): the period in the address, the figures read for it, worded in the reader's language, and the report file. */
export const useOverview = (enabled = true): OverviewHookView => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("overview")
    const format = useFormatter()
    const now = useNow({ updateInterval: CLOCK_TICK_MS })
    const pathname = navigation.usePathname()
    const router = navigation.useRouter()
    const period = periodOfWord(useSearchParams().get(PERIOD_PARAM))
    const read = useQueryWorkspaceDashboardSwr(enabled ? workspaceId : undefined, period)
    const { mutate } = read
    const tools: OverviewTools = { t, format, now }
    const range = rangeOfPeriod(period, now)
    const dayText = (day: Date): string =>
        format.dateTime(day, { day: "2-digit", month: "2-digit", timeZone: BUSINESS_TIME_ZONE })
    const written = { from: dayText(range.first), to: dayText(range.last) }
    const slot = mapSlot(slotOfSwr(read), (data) => overviewViewOf(data, tools, period))
    return {
        period,
        periods: OVERVIEW_PERIODS,
        range: written,
        slot,
        placeholder: overviewViewOf(PLACEHOLDER_OVERVIEW, tools, period),
        isWaiting: isWaitingOf(slot),
        setPeriod: (next) => router.replace(`${pathname}?${PERIOD_PARAM}=${periodWordOf(next)}`),
        refresh: () => void mutate(),
        exportReport: () => {
            if (read.data === undefined) return
            const stamp = format.dateTime(now, { dateStyle: "short", timeZone: BUSINESS_TIME_ZONE }).replaceAll("/", "-")
            saveTextFile(
                `nivo-overview-${periodWordOf(period)}-${stamp}.csv`,
                overviewCsvOf(read.data, tools, `${written.from} - ${written.to}`),
            )
        },
    }
}
