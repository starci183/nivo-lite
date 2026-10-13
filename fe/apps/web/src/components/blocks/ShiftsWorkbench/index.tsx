"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { useShiftsBenchData, useShiftsMineData } from "@/hooks/shifts"
import type { ShiftsFiguresView } from "@/modules/types"
import { ShiftsWorkbenchBase } from "./component"

/** What the page hands the block: the deep link of `?tab=` and the installation the workbench is opened for. */
interface ShiftsWorkbenchProps {
    readonly initialTab: string | null
    readonly installationId: string | null
}

const TAB_KEYS = {
    week: "tabWeek",
    requests: "tabRequests",
    setup: "tabSetup",
    quick: "tabQuick",
    mine: "tabMine",
} as const

type TabId = keyof typeof TAB_KEYS

const MANAGER_TABS: ReadonlyArray<TabId> = ["week", "requests", "setup", "quick"]

const isTab = (key: string | null): key is TabId => key !== null && key in TAB_KEYS

/** The connected Shifts workbench: reads the workbench and the person's own schedule from the back end GraphQL API and hands the settled view to the drawing half. */
export const ShiftsWorkbench = (props: ShiftsWorkbenchProps) => {
    const t = useTranslations("shifts")
    const tf = useTranslations("workbenchFigures")
    const format = useFormatter()
    const [monday, setMonday] = useState<string | null>(null)
    const home = useShiftsBenchData(null)
    const shown = useShiftsBenchData(monday)
    const mine = useShiftsMineData()
    const bench = home.data
    const isFailed = home.error !== undefined || mine.error !== undefined
    const open =
        bench === undefined
            ? 0
            : bench.requests.leaves.filter((leave) => leave.status === "pending").length +
              bench.requests.swaps.filter((swap) => swap.status === "pending").length +
              bench.requests.availability.filter((row) => row.status === "pending").length
    const tabIds: ReadonlyArray<TabId> = mine.data?.profileId ? [...MANAGER_TABS, "mine"] : MANAGER_TABS
    const week = shown.data

    const figuresOf = (figures: ShiftsFiguresView): ReadonlyArray<DescriptionListStatItem> => [
        {
            id: "week",
            term: tf("shWeek"),
            description: figures.weekHasSchedule
                ? `${format.number(figures.weekFilled)}/${format.number(figures.weekTotal)}`
                : "-",
            meta: figures.weekHasSchedule
                ? tf("shWeekMeta", { filled: figures.weekFilled, total: figures.weekTotal })
                : tf("shWeekNone"),
        },
        { id: "gaps", term: tf("shGaps"), description: format.number(figures.openGaps), meta: tf("shGapsMeta") },
        {
            id: "leave",
            term: tf("shLeave"),
            description: format.number(figures.leavePending),
            meta: tf("shLeaveMeta"),
        },
        {
            id: "hours",
            term: tf("shHours"),
            description: format.number(figures.hoursMonth),
            unit: tf("shHoursUnit"),
            meta: tf("shHoursMeta"),
        },
    ]

    return (
        <ShiftsWorkbenchBase
            props={{
                installationId: props.installationId,
                initialTab: isTab(props.initialTab) ? props.initialTab : null,
                isLoading: (bench === undefined || mine.data === undefined) && !isFailed,
                isFailed: bench === undefined || mine.data === undefined ? isFailed : false,
                isStaff: bench?.role === "staff",
                figures: home.figures === null ? [] : figuresOf(home.figures),
                figuresFailed: home.figures === null,
                tabs: tabIds.map((id) => ({
                    id,
                    label: id === "requests" && open > 0 ? `${t("tabRequests")} (${open})` : t(TAB_KEYS[id]),
                })),
                bench,
                week,
                mine: mine.data,
                noScheduleTitle: t("noScheduleTitle"),
                noScheduleBody: t(
                    week !== undefined && week.setup.blocks.length > 0 && week.setup.staff.length > 0
                        ? "noScheduleBody"
                        : "needSetup",
                ),
                noProfileTitle: t("noProfileTitle"),
                noProfileBody: t("noProfileBody"),
            }}
            on={{ week: setMonday }}
        />
    )
}
