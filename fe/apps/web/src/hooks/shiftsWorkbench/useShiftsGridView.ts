import { useTranslations } from "next-intl"
import { useShiftsFormat } from "@/hooks/shifts"
import type { ShiftsWeekViews, ShiftsWeekActions } from "@/modules/types"
import { useShiftsGridActions } from "./useShiftsGridActions"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
type GridRowView = ShiftsWeekViews["gridGridRowView"]
type FullView = { readonly props: ShiftsWeekViews["gridData"]; readonly on: ShiftsWeekActions["grid"] }
const OPEN_ROW = "open"
type GridRowsInput = NonNullable<ReturnType<typeof useShiftsGridActions>["cells"]> &
    ReturnType<typeof useShiftsGridActions> & { readonly format: ReturnType<typeof useShiftsFormat> }

const createGridRows = (context: GridRowsInput) => {
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

const createGridProps = (context: ReturnType<typeof createGridRows>): FullView => {
    const { t, format, picked, setPicked, setOver, setDayIndex, editable } = context
    const { dates, live, people, move, chipOf, day, rows } = context
    return {
        props: {
            hint: t(editable ? "gridHintEdit" : "gridHintView"),
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
            drop: (shiftId, rowId) => move(shiftId, rowId === OPEN_ROW ? null : rowId),
            place: (rowId) => {
                if (picked !== null) move(picked, rowId === OPEN_ROW ? null : rowId)
            },
            day: (date) => setDayIndex(Math.max(0, dates.indexOf(date))),
            assign: (shiftId, rowId) => move(shiftId, rowId === OPEN_ROW ? null : rowId),
        },
    }
}

/** Resolves the existing desktop grid and phone day list from the week controller. */
export const useShiftsGridView = (input: ShiftsPanelInput) => {
    const t = useTranslations("shifts"),
        format = useShiftsFormat(),
        actions = useShiftsGridActions(input)
    const copy: ShiftsWeekViews["gridCopy"] = {
        dayLabels: format.weekdays,
        title: t("gridTitle"),
        emptyDay: t("noShiftsDay"),
        assignLabel: t("assignTo"),
        onLeaveLabel: t("onLeave"),
        openId: OPEN_ROW,
    }
    const cells = actions.cells
    if (cells === undefined) return { copy, data: undefined, on: undefined }
    if (cells.bench.week.current === null || cells.bench.role === "staff")
        return { copy, data: undefined, on: undefined }
    const view = createGridProps(createGridRows({ ...cells, ...actions, format }))
    return { copy, data: view.props, on: view.on }
}
