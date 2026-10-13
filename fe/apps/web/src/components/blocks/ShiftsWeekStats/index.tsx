"use client"

import { useTranslations } from "next-intl"
import { useShiftsBenchData, useShiftsFormat } from "@/hooks/shifts"
import { useShiftsWeekStore } from "@/hooks/zustand/shiftsWeek"
import { useShiftsWeekModel } from "@/hooks/shiftsCoverage"
import { ShiftsWeekStatsBase } from "./component"

const NO_MOVES: Readonly<Record<string, string | null>> = {}

/** The figures of the week (wages, assigned shifts, short blocks, rule breaks) and the explanation of the schedule. */
export const ShiftsWeekStats = () => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const selected = useShiftsWeekStore((state) => state.monday)
    const bench = useShiftsBenchData(selected).data
    const model = useShiftsWeekModel(bench, NO_MOVES)
    if (bench === undefined || model === undefined || bench.week.current === null || bench.role === "staff") return null
    const { current, monday } = bench.week
    const open = model.shifts.filter((shift) => shift.staffId === null).length
    const short = model.cells.filter((cell) => cell.status === "short").length
    const explanation = current?.explanation.trim() ?? ""
    const isDraft = current?.status === "draft"
    const lines = explanation
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((text, position) => ({ id: String(position), text }))
    const sourceLabel = current?.explanationSource === "openclaw" ? t("byOpenClaw") : t("autoSummary")

    return (
        <ShiftsWeekStatsBase
            props={{
                ariaLabel: t("weekOf", { range: format.weekRange(monday) }),
                stats: [
                    {
                        id: "cost",
                        term: t("mCost"),
                        value: format.money(model.cost.total),
                        meta: t("mCostHint"),
                        isAlert: false,
                    },
                    {
                        id: "shifts",
                        term: t("mShifts"),
                        value: String(model.shifts.length - open),
                        meta: open > 0 ? t("openCount", { n: open }) : t("noOpen"),
                        isAlert: false,
                    },
                    { id: "short", term: t("mShort"), value: String(short), meta: t("mShortHint"), isAlert: short > 0 },
                    {
                        id: "broken",
                        term: t("mBroken"),
                        value: String(model.broken.size),
                        meta: t("mBrokenHint"),
                        isAlert: model.broken.size > 0,
                    },
                ],
                explainTitle: t("explainTitle"),
                explainNone: t("explainNone"),
                lines,
                source:
                    explanation === ""
                        ? null
                        : { label: sourceLabel, isOpenClaw: current?.explanationSource === "openclaw" },
                hasExplanation: explanation !== "" || isDraft,
            }}
        />
    )
}
