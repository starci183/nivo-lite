import type { ShiftsWeekViews, ShiftsWeekActions } from "@/modules/types"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
type FullView = { readonly props: ShiftsWeekViews["weekStatsData"]; readonly on: ShiftsWeekActions["weekStats"] }

import { useTranslations } from "next-intl"
import { useShiftsFormat } from "@/hooks/shifts"
import { useShiftsWeekModel } from "@/hooks/shiftsCoverage"

const NO_MOVES: Readonly<Record<string, string | null>> = {}

type UseShiftsWeekStatsViewResult =
    | {
          copy: Omit<
              {
                  readonly captions: ReadonlyArray<{
                      readonly id: string
                      readonly term: string
                      readonly meta: string
                  }>
                  readonly ariaLabel: string
                  readonly stats: ReadonlyArray<ShiftsWeekViews["weekStatsWeekStatView"]>
                  readonly explainTitle: string
                  readonly explainNone: string
                  readonly lines: ReadonlyArray<{
                      readonly id: string
                      readonly text: string
                  }>
                  readonly source: {
                      readonly label: string
                      readonly isOpenClaw: boolean
                  } | null
                  readonly hasExplanation: boolean
              },
              "ariaLabel" | "stats" | "lines" | "source" | "hasExplanation"
          >
          data: undefined
          on: undefined
      }
    | {
          copy: Omit<
              {
                  readonly captions: ReadonlyArray<{
                      readonly id: string
                      readonly term: string
                      readonly meta: string
                  }>
                  readonly ariaLabel: string
                  readonly stats: ReadonlyArray<ShiftsWeekViews["weekStatsWeekStatView"]>
                  readonly explainTitle: string
                  readonly explainNone: string
                  readonly lines: ReadonlyArray<{
                      readonly id: string
                      readonly text: string
                  }>
                  readonly source: {
                      readonly label: string
                      readonly isOpenClaw: boolean
                  } | null
                  readonly hasExplanation: boolean
              },
              "ariaLabel" | "stats" | "lines" | "source" | "hasExplanation"
          >
          data: Pick<
              {
                  readonly captions: ReadonlyArray<{
                      readonly id: string
                      readonly term: string
                      readonly meta: string
                  }>
                  readonly ariaLabel: string
                  readonly stats: ReadonlyArray<ShiftsWeekViews["weekStatsWeekStatView"]>
                  readonly explainTitle: string
                  readonly explainNone: string
                  readonly lines: ReadonlyArray<{
                      readonly id: string
                      readonly text: string
                  }>
                  readonly source: {
                      readonly label: string
                      readonly isOpenClaw: boolean
                  } | null
                  readonly hasExplanation: boolean
              },
              "ariaLabel" | "stats" | "lines" | "source" | "hasExplanation"
          >
          on: Record<string, never>
      }

/** The figures of the week (wages, assigned shifts, short blocks, rule breaks) and the explanation of the schedule. */
export const useShiftsWeekStatsView = (input: ShiftsPanelInput): UseShiftsWeekStatsViewResult => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const bench = input.bench.data
    const model = useShiftsWeekModel(bench, NO_MOVES)
    const copy: ShiftsWeekViews["weekStatsCopy"] = {
        captions: [
            { id: "cost", term: t("mCost"), meta: t("mCostHint") },
            { id: "shifts", term: t("mShifts"), meta: "" },
            { id: "short", term: t("mShort"), meta: t("mShortHint") },
            { id: "broken", term: t("mBroken"), meta: t("mBrokenHint") },
        ],
        explainTitle: t("explainTitle"),
        explainNone: t("explainNone"),
    }

    if (bench === undefined || model === undefined || bench.week.current === null || bench.role === "staff")
        return { copy, data: undefined, on: undefined }
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

    const view: FullView = {
        props: {
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
            lines,
            source:
                explanation === ""
                    ? null
                    : { label: sourceLabel, isOpenClaw: current?.explanationSource === "openclaw" },
            hasExplanation: explanation !== "" || isDraft,
        },
        on: {},
    }

    return { copy, data: view.props, on: view.on }
}
