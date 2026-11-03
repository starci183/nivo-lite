import type { ShiftsWeekViews, ShiftsWeekActions } from "@/modules/types"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
type FullView = { readonly props: ShiftsWeekViews["coverageData"]; readonly on: ShiftsWeekActions["coverage"] }
type CoverageTone = ShiftsWeekViews["coverageCoverageTone"]

import { useTranslations } from "next-intl"
import { useShiftsFormat } from "@/hooks/shifts"
import { useShiftsWeekModel } from "@/hooks/shiftsCoverage"
import type { ShiftsCoverageCell } from "@/hooks/shiftsCoverage"
import { isoWeekDates } from "@/hooks/shiftsTime"

const NO_MOVES: Readonly<Record<string, string | null>> = {}

const READING_KEYS = { short: "cShort", over: "cOver", ok: "cOk" } as const

const TONES: Readonly<Record<ShiftsCoverageCell["status"], CoverageTone>> = {
    short: "negative",
    over: "cautionary",
    ok: "affirmative",
}

type UseShiftsCoverageViewResult =
    | {
          copy: Omit<
              {
                  readonly dayLabels: ReadonlyArray<{
                      readonly id: string
                      readonly label: string
                  }>
                  readonly title: string
                  readonly hint: string
                  readonly days: ReadonlyArray<ShiftsWeekViews["coverageCoverageDayView"]>
              },
              "days"
          >
          data: undefined
          on: undefined
      }
    | {
          copy: Omit<
              {
                  readonly dayLabels: ReadonlyArray<{
                      readonly id: string
                      readonly label: string
                  }>
                  readonly title: string
                  readonly hint: string
                  readonly days: ReadonlyArray<ShiftsWeekViews["coverageCoverageDayView"]>
              },
              "days"
          >
          data: Pick<
              {
                  readonly dayLabels: ReadonlyArray<{
                      readonly id: string
                      readonly label: string
                  }>
                  readonly title: string
                  readonly hint: string
                  readonly days: ReadonlyArray<ShiftsWeekViews["coverageCoverageDayView"]>
              },
              "days"
          >
          on: Record<string, never>
      }

/** People on duty against the minimum of every coverage block, day by day. */
export const useShiftsCoverageView = (input: ShiftsPanelInput): UseShiftsCoverageViewResult => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const bench = input.bench.data
    const model = useShiftsWeekModel(bench, NO_MOVES)
    const copy: ShiftsWeekViews["coverageCopy"] = {
        dayLabels: format.weekdays,
        title: t("coverageTitle"),
        hint: t("coverageHint"),
    }

    if (
        bench === undefined ||
        model === undefined ||
        bench.week.current === null ||
        bench.setup.blocks.length === 0 ||
        bench.role === "staff"
    )
        return { copy, data: undefined, on: undefined }
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

    const view: FullView = {
        props: {
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
        },
        on: {},
    }
    return { copy, data: view.props, on: view.on }
}
