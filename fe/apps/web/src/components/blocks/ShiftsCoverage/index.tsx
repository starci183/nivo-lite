"use client"

import { useTranslations } from "next-intl"
import { useShiftsBenchData, useShiftsFormat } from "@/hooks/shifts"
import { useShiftsWeekStore } from "@/hooks/zustand/shiftsWeek"
import { useShiftsWeekModel } from "@/hooks/shiftsCoverage"
import type { ShiftsCoverageCell } from "@/hooks/shiftsCoverage"
import { isoWeekDates } from "@/hooks/shiftsTime"
import { ShiftsCoverageBase } from "./component"
import type { CoverageTone } from "./component"

const NO_MOVES: Readonly<Record<string, string | null>> = {}

const READING_KEYS = { short: "cShort", over: "cOver", ok: "cOk" } as const

const TONES: Readonly<Record<ShiftsCoverageCell["status"], CoverageTone>> = {
    short: "negative",
    over: "cautionary",
    ok: "affirmative",
}

/** People on duty against the minimum of every coverage block, day by day. */
export const ShiftsCoverage = () => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const selected = useShiftsWeekStore((state) => state.monday)
    const bench = useShiftsBenchData(selected).data
    const model = useShiftsWeekModel(bench, NO_MOVES)
    if (
        bench === undefined ||
        model === undefined ||
        bench.week.current === null ||
        bench.setup.blocks.length === 0 ||
        bench.role === "staff"
    )
        return null
    const { positions } = bench.setup
    const positionName = (id: string): string => positions.find((position) => position.id === id)?.name ?? ""
    const reading = (cell: ShiftsCoverageCell): string => {
        const ideal = cell.ideal > cell.min ? `-${cell.ideal}` : ""
        return `${cell.have}/${cell.min}${ideal} ${t(READING_KEYS[cell.status])}`
    }
    const labelOf = (cell: ShiftsCoverageCell): string => {
        const peak = cell.peak ? ` ${t("peakTag")}` : ""
        return `${positionName(cell.positionId)} ${cell.start.slice(0, 2)}-${cell.end.slice(0, 2)}${peak}`
    }

    return (
        <ShiftsCoverageBase
            props={{
                title: t("coverageTitle"),
                hint: t("coverageHint"),
                days: isoWeekDates(bench.week.monday).map((date) => ({
                    id: date,
                    label: `${format.dayShort(date)} ${format.dayMonth(date)}`,
                    meters: model.cells
                        .filter((cell) => cell.date === date)
                        .sort((a, b) => a.start.localeCompare(b.start))
                        .map((cell) => ({
                            id: cell.blockId,
                            label: labelOf(cell),
                            value: Math.min(cell.have, Math.max(1, cell.ideal)),
                            max: Math.max(1, cell.ideal),
                            reading: reading(cell),
                            tone: TONES[cell.status],
                        })),
                })),
            }}
        />
    )
}
