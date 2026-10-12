const ZONE = "Asia/Ho_Chi_Minh"
const OFFSET = "+07:00"
const HOURS_OFFSET_MS = 7 * 3_600_000
const DAY_MS = 86_400_000
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const SPREADSHEET_BOM = "﻿"

/** The instants a period starts and ends at, ISO 8601. */
export interface InstantRange {
    /** The first instant. */
    readonly from: string
    /** The first instant after the period. */
    readonly to: string
}

/** A month: its instants and its label. */
export interface PeriodRange extends InstantRange {
    /** The month as mm/yyyy. */
    readonly label: string
}

/** An amount in dong, rounded, with the Vietnamese thousands separator. */
export const vnd = (amount: number): string => `${Math.round(amount).toLocaleString("vi-VN")} ₫`

/** A date as dd/mm/yyyy in Vietnam time. */
export const dmy = (value: string | Date): string =>
    new Date(value).toLocaleDateString("vi-VN", { timeZone: ZONE, day: "2-digit", month: "2-digit", year: "numeric" })

/** The Vietnam calendar day (yyyy-mm-dd) of an instant. */
export const vnDay = (at: Date): string => new Date(at.getTime() + HOURS_OFFSET_MS).toISOString().slice(0, 10)

/** The day a request names, or today when it names none or a malformed one. */
export const dayOf = (requested: string | null | undefined, now: Date): string =>
    requested !== null && requested !== undefined && DAY.test(requested) ? requested : vnDay(now)

/** The instants a Vietnam day starts and ends at. */
export const dayRange = (day: string): InstantRange => {
    const start = new Date(`${day}T00:00:00${OFFSET}`)
    return { from: start.toISOString(), to: new Date(start.getTime() + DAY_MS).toISOString() }
}

/** The month a request names (yyyy-mm), or last month when it names none or a malformed one. */
export const periodOf = (requested: string | null | undefined, now: Date): string => {
    if (requested !== null && requested !== undefined && PERIOD.test(requested)) return requested
    const local = new Date(now.getTime() + HOURS_OFFSET_MS)
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1)).toISOString().slice(0, 7)
}

/** The instants a month starts and ends at in Vietnam time, and its label (mm/yyyy). */
export const periodRange = (period: string): PeriodRange => {
    const [year = 0, month = 1] = period.split("-").map(Number)
    const nextYear = month === 12 ? year + 1 : year
    const nextMonth = month === 12 ? 1 : month + 1
    return {
        from: new Date(`${period}-01T00:00:00${OFFSET}`).toISOString(),
        to: new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00${OFFSET}`).toISOString(),
        label: `${String(month).padStart(2, "0")}/${year}`,
    }
}

/** How many whole days an invoice is overdue; never negative. */
export const daysLate = (dueAt: string | Date, now: Date): number =>
    Math.max(0, Math.floor((now.getTime() - new Date(dueAt).getTime()) / DAY_MS))

const csvCell = (value: string | number | null | undefined): string => {
    const text = String(value ?? "")
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Rows as CSV: a byte order mark so Excel reads Vietnamese, CRLF line ends, cells quoted when they need it. */
export const csvOf = (rows: ReadonlyArray<ReadonlyArray<string | number | null>>): string =>
    `${SPREADSHEET_BOM}${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`
