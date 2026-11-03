import { useState } from "react"
import { useTranslations } from "next-intl"
import { useFeatureReset } from "@/hooks/reuseables"
import { useShiftsWeekCommands } from "@/hooks/shiftsCommands"
import { useShiftsWeekModel } from "@/hooks/shiftsCoverage"
import { isoWeekDates } from "@/hooks/shiftsTime"
import type { ShiftsShiftView, ShiftsWeekView, ShiftsStaffView, ShiftsWeekViews } from "@/modules/types"
import { useShiftsOperation } from "./useShiftsOperation"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
import type { SetStateAction, Dispatch } from "react"
type GridChipView = ShiftsWeekViews["gridGridChipView"]
type GridCellView = ShiftsWeekViews["gridGridCellView"]
const OPEN_ROW = "open"
const VIOLATION_KEYS = {
    overlap: "vOverlap",
    unavailable: "vUnavailable",
    leave: "vLeave",
    max_day: "vMaxDay",
    max_week: "vMaxWeek",
    rest: "vRest",
    position: "vPosition",
} as const
interface GridCellsInput {
    readonly t: ReturnType<typeof useTranslations<"shifts">>
    readonly bench: NonNullable<ShiftsPanelInput["bench"]["data"]>
    readonly picked: string | null
    readonly over: string | null
    readonly model: NonNullable<ReturnType<typeof useShiftsWeekModel>>
}
const createGridCells = (context: GridCellsInput) => {
    const { t, bench, picked, over, model } = context

    const { setup, week: weekView } = bench
    const editable = weekView.current?.status === "draft"
    const dates = isoWeekDates(weekView.monday)
    const live = model.shifts.filter((shift) => shift.status !== "cancelled")
    const pickedShift = live.find((shift) => shift.id === picked)
    const people = setup.staff.filter((person) => person.active)
    const positionOf = (id: string) => setup.positions.find((position) => position.id === id)
    const whyOf = (shift: ShiftsShiftView): string =>
        (model.broken.get(shift.id) ?? []).map((kind) => t(VIOLATION_KEYS[kind])).join(", ")

    const chipOf = (shift: ShiftsShiftView): GridChipView => {
        const position = positionOf(shift.positionId)
        const why = whyOf(shift)
        return {
            id: shift.id,
            time: `${shift.start}-${shift.end}`,
            position: position?.name ?? "",
            color: position?.color ?? "",
            why: why === "" ? "" : `${t("breaks")}: ${why}`,
            isOpen: shift.staffId === null,
            isPicked: picked === shift.id,
        }
    }
    const cellOf = (staffId: string | null, date: string): GridCellView => {
        const rowKey = staffId ?? OPEN_ROW
        const key = `${rowKey}|${date}`
        const chips = live
            .filter((shift) => shift.staffId === staffId && shift.date === date)
            .sort((a, b) => a.start.localeCompare(b.start))
            .map(chipOf)
        const canDrop = editable && pickedShift?.date === date
        const isOff =
            staffId !== null &&
            weekView.approvedLeaves.some((leave) => leave.staffId === staffId && leave.from <= date && leave.to >= date)
        return { id: key, date, chips, canDrop, isTarget: over === key && canDrop, isOff }
    }
    return { ...context, weekView, editable, dates, live, people, chipOf, cellOf }
}

type UseShiftsGridActionsResult = {
    cells:
        | {
              weekView: ShiftsWeekView
              editable: boolean
              dates: string[]
              live: ShiftsShiftView[]
              people: ShiftsStaffView[]
              chipOf: (shift: ShiftsShiftView) => GridChipView
              cellOf: (staffId: string | null, date: string) => GridCellView
              t: ReturnType<typeof useTranslations<"shifts">>
              bench: NonNullable<ShiftsPanelInput["bench"]["data"]>
              picked: string | null
              over: string | null
              model: NonNullable<ReturnType<typeof useShiftsWeekModel>>
          }
        | undefined
    picked: string | null
    setPicked: Dispatch<SetStateAction<string | null>>
    setOver: Dispatch<SetStateAction<string | null>>
    dayIndex: number
    setDayIndex: Dispatch<SetStateAction<number>>
    move: (shiftId: string, staffId: string | null) => void
}

/** Owns the live rule preview and optimistic drag/tap edits for the actually mounted week panel. */
export const useShiftsGridActions = (input: ShiftsPanelInput): UseShiftsGridActionsResult => {
    const t = useTranslations("shifts"),
        week = useShiftsWeekCommands(),
        operation = useShiftsOperation(input)
    const [moves, setMoves] = useState<Readonly<Record<string, string | null>>>({})
    const [picked, setPicked] = useState<string | null>(null),
        [over, setOver] = useState<string | null>(null),
        [dayIndex, setDayIndex] = useState(0)
    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => {
            setMoves({})
            setPicked(null)
            setOver(null)
            setDayIndex(0)
        },
    })
    const bench = input.bench.data,
        model = useShiftsWeekModel(bench, moves)
    const move = (shiftId: string, staffId: string | null): void => {
        const current = model?.shifts.find((shift) => shift.id === shiftId && shift.status !== "cancelled")
        const isCurrent = operation.capture()
        if (!isCurrent()) return
        setPicked(null)
        setOver(null)
        if (current === undefined || current.staffId === staffId) return
        operation.observe(
            operation.run(shiftId, async () => {
                if (isCurrent()) {
                    setPicked(null)
                    setOver(null)
                    setMoves((all) => ({ ...all, [shiftId]: staffId }))
                }
                try {
                    return await week.reassign(shiftId, staffId)
                } finally {
                    if (isCurrent())
                        setMoves((all) => Object.fromEntries(Object.entries(all).filter(([id]) => id !== shiftId)))
                }
            }),
        )
    }
    const cells =
        bench === undefined || model === undefined ? undefined : createGridCells({ t, bench, picked, over, model })
    return { cells, picked, setPicked, setOver, dayIndex, setDayIndex, move }
}
