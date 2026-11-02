import type { ShiftsWeekViews, ShiftsWeekActions } from "@/modules/types"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
type FullView = {
    readonly props: Omit<ShiftsWeekViews["figuresData"], "isVisible">
    readonly on: ShiftsWeekActions["figures"]
}

import { useFormatter, useTranslations } from "next-intl"

/** The four figures of the Shifts workbench (this week, open gaps, leave waiting, hours of the month), or the pointer to "My schedule" for staff. */
export const useShiftsFiguresView = (input: ShiftsPanelInput) => {
    const t = useTranslations("workbenchFigures")
    const ts = useTranslations("shifts")
    const format = useFormatter()
    const { data, figures } = input.bench
    const copy: ShiftsWeekViews["figuresCopy"] = {
        captions: [
            { id: "week", term: t("shWeek"), unit: "" },
            { id: "gaps", term: t("shGaps"), unit: "" },
            { id: "leave", term: t("shLeave"), unit: "" },
            { id: "hours", term: t("shHours"), unit: t("shHoursUnit") },
        ],
        ariaLabel: ts("tabsLabel"),
    }

    if (data === undefined) return { copy, data: undefined, on: undefined }

    const view: FullView = {
        props: {
            staffNotice: data.role === "staff" ? ts("staffOnlyMine") : null,
            stats:
                data.role === "staff" || figures === null
                    ? []
                    : [
                          {
                              id: "week",
                              term: t("shWeek"),
                              value: figures.weekHasSchedule
                                  ? `${format.number(figures.weekFilled)}/${format.number(figures.weekTotal)}`
                                  : "-",
                              unit: "",
                              meta: figures.weekHasSchedule
                                  ? t("shWeekMeta", { filled: figures.weekFilled, total: figures.weekTotal })
                                  : t("shWeekNone"),
                          },
                          {
                              id: "gaps",
                              term: t("shGaps"),
                              value: format.number(figures.openGaps),
                              unit: "",
                              meta: t("shGapsMeta"),
                          },
                          {
                              id: "leave",
                              term: t("shLeave"),
                              value: format.number(figures.leavePending),
                              unit: "",
                              meta: t("shLeaveMeta"),
                          },
                          {
                              id: "hours",
                              term: t("shHours"),
                              value: format.number(figures.hoursMonth),
                              unit: t("shHoursUnit"),
                              meta: t("shHoursMeta"),
                          },
                      ],
        },
        on: {},
    }
    return { copy, data: { ...view.props, isVisible: data.role === "staff" || figures !== null }, on: view.on }
}
