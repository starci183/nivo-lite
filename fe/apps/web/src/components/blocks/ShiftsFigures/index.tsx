"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useShiftsBenchData } from "@/hooks/shifts"
import { ShiftsFiguresBase } from "./component"

/** The four figures of the Shifts workbench (this week, open gaps, leave waiting, hours of the month), or the pointer to "My schedule" for staff. */
export const ShiftsFigures = () => {
    const t = useTranslations("workbenchFigures")
    const ts = useTranslations("shifts")
    const format = useFormatter()
    const { data, figures } = useShiftsBenchData(null)
    if (data === undefined) return null

    return (
        <ShiftsFiguresBase
            props={{
                ariaLabel: ts("tabsLabel"),
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
            }}
        />
    )
}
