import type { MonthRow, MonthSummary, ShiftStaff } from "../shifts.contracts"
import type { AlertShift } from "./shift-alerts.policy"
import { toMin } from "./time.policy"

const oneDecimal = (value: number): number => Math.round(value * 10) / 10

const hoursOf = (items: ReadonlyArray<AlertShift>): number =>
    items.reduce((total, item) => total + (toMin(item.shift.end) - toMin(item.shift.start)) / 60, 0)

/** The people a month summary reads: who they are and what they earn per hour. */
export interface PayeeSource {
    /** The people. */
    readonly staff: ReadonlyArray<Pick<ShiftStaff, "id" | "name" | "wage">>
}

/** Hours x wage of one month from the published shifts; checked-in hours are noted apart, since checking in is optional. */
export const monthSummaryOf = (setup: PayeeSource, items: ReadonlyArray<AlertShift>): MonthSummary => {
    const rows = setup.staff
        .map((person): MonthRow => {
            const mine = items.filter((item) => item.shift.staffId === person.id)
            const hours = hoursOf(mine)
            return {
                name: person.name,
                shifts: mine.length,
                hours: oneDecimal(hours),
                checked: oneDecimal(hoursOf(mine.filter((item) => item.checkedIn))),
                wage: person.wage,
                cost: Math.round(hours * person.wage),
            }
        })
        .filter((row) => row.shifts > 0)
    return {
        rows,
        total: rows.reduce((sum, row) => sum + row.cost, 0),
        hours: rows.reduce((sum, row) => sum + row.hours, 0),
    }
}

const cell = (value: string | number): string => `"${String(value).replace(/"/gu, '""')}"`

/** The CSV of a month summary: a header line, one line per person and the total line. */
export const monthCsvOf = (summary: MonthSummary, header: string, totalLabel: string): string =>
    [
        header,
        ...summary.rows.map((row) =>
            [row.name, row.shifts, row.hours, row.checked, row.wage, row.cost].map(cell).join(","),
        ),
        [totalLabel, "", oneDecimal(summary.hours), "", "", summary.total].map(cell).join(","),
    ].join("\n")

/** "09/2026" for "2026-09". */
export const monthLabel = (month: string): string => `${month.slice(5, 7)}/${month.slice(0, 4)}`

/** The marker that opens the Office line of a closed month, so the month is closed once. */
export const payrollMarker = (month: string): string => `[payroll:${month}]`
