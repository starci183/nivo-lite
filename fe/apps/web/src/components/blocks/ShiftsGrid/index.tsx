"use client"

import { ShiftsGridBase, type GridCellView, type GridChipView, type GridRowView } from "./component"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsBenchData, useShiftsFormat } from "@/hooks/shifts"
import { useShiftsWeekCommands } from "@/hooks/shiftsCommands"
import { useShiftsWeekStore } from "@/hooks/zustand/shiftsWeek"
import { useShiftsWeekModel } from "@/hooks/shiftsCoverage"
import { isoWeekDates } from "@/hooks/shiftsTime"
import type { ShiftsShiftView } from "@/modules/types"

/** State values and commands consumed by the connected surface. */
type ShiftsGridControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"shifts">>
    readonly format: ReturnType<typeof useShiftsFormat>
    readonly week: ReturnType<typeof useShiftsWeekCommands>
    readonly bench: NonNullable<ReturnType<typeof useShiftsBenchData>>["data"]
    readonly setMoves: React.Dispatch<React.SetStateAction<Readonly<Record<string, string | null>>>>
    readonly picked: string | null
    readonly setPicked: React.Dispatch<React.SetStateAction<string | null>>
    readonly over: string | null
    readonly setOver: React.Dispatch<React.SetStateAction<string | null>>
    readonly dayIndex: number
    readonly setDayIndex: React.Dispatch<React.SetStateAction<number>>
    readonly model: ReturnType<typeof useShiftsWeekModel>
}

/** Narrowed schedule data available after the access guard. */
type GridCellsInput = ShiftsGridControllerInput & {
    bench: NonNullable<ShiftsGridControllerInput["bench"]>
    model: NonNullable<ShiftsGridControllerInput["model"]>
}

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

const createGridCells = (context: GridCellsInput) => {
    const { t, week, bench, setMoves, picked, setPicked, over, setOver, model } = context

    const { setup, week: weekView } = bench
    const editable = weekView.current?.status === "draft"
    const dates = isoWeekDates(weekView.monday)
    const live = model.shifts.filter((shift) => shift.status !== "cancelled")
    const pickedShift = live.find((shift) => shift.id === picked)
    const people = setup.staff.filter((person) => person.active)
    const positionOf = (id: string) => setup.positions.find((position) => position.id === id)
    const whyOf = (shift: ShiftsShiftView): string =>
        (model.broken.get(shift.id) ?? []).map((kind) => t(VIOLATION_KEYS[kind])).join(", ")

    const move = async (shiftId: string, staffId: string | null): Promise<void> => {
        const current = live.find((shift) => shift.id === shiftId)
        setPicked(null)
        setOver(null)
        if (current === undefined || current.staffId === staffId) return
        setMoves((all) => ({ ...all, [shiftId]: staffId }))
        await week.reassign(shiftId, staffId)
        setMoves((all) => Object.fromEntries(Object.entries(all).filter(([id]) => id !== shiftId)))
    }
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
    return { ...context, weekView, editable, dates, live, people, move, chipOf, cellOf }
}

const createGridRows = (context: ReturnType<typeof createGridCells>) => {
    const { t, format, dayIndex, model, weekView, dates, live, people, cellOf } = context

    const rows: Array<GridRowView> = [
        ...people.map((person) => {
            const minutes = model.cost.byStaff.get(person.id)?.minutes ?? 0
            const wage = person.wage > 0 ? ` · ${format.money(model.cost.byStaff.get(person.id)?.cost ?? 0)}` : ""
            return {
                id: person.id,
                name: person.name,
                sub: `${format.hours(minutes)}/${format.hours(person.maxWeek * 60)}${wage}`,
                cells: dates.map((date) => cellOf(person.id, date)),
            }
        }),
        {
            id: OPEN_ROW,
            name: t("openShift"),
            sub: live.some((shift) => shift.staffId === null)
                ? t("openCount", { n: live.filter((shift) => shift.staffId === null).length })
                : "",
            cells: dates.map((date) => cellOf(null, date)),
        },
    ]
    const day = dates[dayIndex] ?? weekView.monday
    return { ...context, rows, day }
}

const createGridProps = (context: ReturnType<typeof createGridRows>): React.ComponentProps<typeof ShiftsGridBase> => {
    const { t, format, picked, setPicked, setOver, setDayIndex, editable } = context
    const { dates, live, people, move, chipOf, day, rows } = context
    return {
        props: {
            title: t("gridTitle"),
            hint: t(editable ? "gridHintEdit" : "gridHintView"),
            emptyDay: t("noShiftsDay"),
            assignLabel: t("assignTo"),
            onLeaveLabel: t("onLeave"),
            openId: OPEN_ROW,
            editable,
            dates: dates.map((date) => ({ id: date, label: `${format.dayShort(date)} ${format.dayMonth(date)}` })),
            rows,
            selectedDay: day,
            dayShifts: live
                .filter((shift) => shift.date === day)
                .sort((a, b) => a.start.localeCompare(b.start))
                .map((shift) => ({
                    ...chipOf(shift),
                    staffId: shift.staffId ?? OPEN_ROW,
                    staffName: people.find((person) => person.id === shift.staffId)?.name ?? t("openShift"),
                })),
            assignOptions: [
                { id: OPEN_ROW, label: t("openShift") },
                ...people.map((person) => ({ id: person.id, label: person.name })),
            ],
        },
        on: {
            pick: (shiftId) => setPicked(picked === shiftId ? null : shiftId),
            dragStart: setPicked,
            dragEnd: () => {
                setPicked(null)
                setOver(null)
            },
            hover: setOver,
            drop: (shiftId, rowId) => void move(shiftId, rowId === OPEN_ROW ? null : rowId),
            place: (rowId) => {
                if (picked !== null) void move(picked, rowId === OPEN_ROW ? null : rowId)
            },
            day: (date) => setDayIndex(Math.max(0, dates.indexOf(date))),
            assign: (shiftId, rowId) => void move(shiftId, rowId === OPEN_ROW ? null : rowId),
        },
    }
}

/** The schedule grid: people by days with drag or tap to reassign (a draft only), and the day list for phones. */
export const ShiftsGrid = () => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const week = useShiftsWeekCommands()
    const selected = useShiftsWeekStore((state) => state.monday)
    const bench = useShiftsBenchData(selected).data
    const [moves, setMoves] = useState<Readonly<Record<string, string | null>>>({})
    const [picked, setPicked] = useState<string | null>(null)
    const [over, setOver] = useState<string | null>(null)
    const [dayIndex, setDayIndex] = useState(0)
    const model = useShiftsWeekModel(bench, moves)
    const state: ShiftsGridControllerInput = {
        t,
        format,
        week,
        bench,
        setMoves,
        picked,
        setPicked,
        over,
        setOver,
        dayIndex,
        setDayIndex,
        model,
    }
    if (bench === undefined || model === undefined || bench.week.current === null || bench.role === "staff") return null
    return <ShiftsGridBase {...createGridProps(createGridRows(createGridCells({ ...state, bench, model })))} />
}
