"use client"

import { useTranslations } from "next-intl"
import { useShiftsFormat } from "@/hooks/shifts"
import { useShiftsWeekModel } from "@/hooks/shiftsCoverage"
import type { ShiftsCoverageCell } from "@/hooks/shiftsCoverage"
import { isoWeekDates } from "@/hooks/shiftsTime"
import type { ShiftsBenchView } from "@/modules/types"
import { ShiftsCoverageBase } from "./component"
import type { CoverageTone } from "./component"

/** The week whose coverage is drawn. */
interface ShiftsCoverageProps {
    readonly bench: ShiftsBenchView
}

const NO_MOVES: Readonly<Record<string, string | null>> = {}

const READING_KEYS = { short: "cShort", over: "cOver", ok: "cOk" } as const

const TONES: Readonly<Record<ShiftsCoverageCell["status"], CoverageTone>> = {
    short: "negative",
    over: "cautionary",
    ok: "affirmative",
}

/** People on duty against the minimum of every coverage block, day by day. */
export const ShiftsCoverage = (props: ShiftsCoverageProps) => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const model = useShiftsWeekModel(props.bench, NO_MOVES)
    const { positions } = props.bench.setup
    const positionName = (id: string): string => positions.find((position) => position.id === id)?.name ?? ""
    const reading = (cell: ShiftsCoverageCell): string =>
        `${cell.have}/${cell.min}${cell.ideal > cell.min ? `-${cell.ideal}` : ""} ${t(READING_KEYS[cell.status])}`

    return (
        <ShiftsCoverageBase
            props={{
                title: t("coverageTitle"),
                hint: t("coverageHint"),
                days: isoWeekDates(props.bench.week.monday).map((date) => ({
                    id: date,
                    label: `${format.dayShort(date)} ${format.dayMonth(date)}`,
                    meters: model.cells
                        .filter((cell) => cell.date === date)
                        .sort((a, b) => a.start.localeCompare(b.start))
                        .map((cell) => ({
                            id: cell.blockId,
                            label: `${positionName(cell.positionId)} ${cell.start.slice(0, 2)}-${cell.end.slice(0, 2)}${cell.peak ? ` ${t("peakTag")}` : ""}`,
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
