import type { Setup, Shift } from "../shifts.contracts"
import { addDays, weekdayOf } from "./time.policy"

/** The weekday names a label uses, Monday first. */
export type WeekdayNames = ReadonlyArray<string>

/** "Monday 06/10": the weekday name and the day and month of a YYYY-MM-DD day. */
export const dayLabel = (date: string, names: WeekdayNames): string =>
    `${names[weekdayOf(date)] ?? ""} ${date.slice(8, 10)}/${date.slice(5, 7)}`.trim()

/** "06/10 - 12/10": the first and last day of the week that starts on `monday`. */
export const weekLabel = (monday: string, names: WeekdayNames): string =>
    `${dayLabel(monday, names).slice(-5)} - ${dayLabel(addDays(monday, 6), names).slice(-5)}`

/** One line of a person's schedule: the day, the hours and the position. */
export const shiftLine = (setup: Pick<Setup, "positions">, shift: Shift, names: WeekdayNames): string =>
    `${dayLabel(shift.date, names)} ${shift.start}-${shift.end} ${setup.positions.find((p) => p.id === shift.positionId)?.name ?? ""}`.trim()

/** The name of a person, or a dash for none or an unknown person. */
export const nameOf = (setup: Pick<Setup, "staff">, id: string | null): string =>
    id === null ? "-" : (setup.staff.find((p) => p.id === id)?.name ?? "-")

/** An amount in dong with thousands separators and the currency sign. */
export const money = (amount: number): string =>
    `${Math.round(amount).toLocaleString("vi-VN")}${String.fromCodePoint(273)}`
