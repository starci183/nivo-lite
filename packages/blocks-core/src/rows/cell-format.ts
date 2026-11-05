import { textOf } from "../slots/paths"

/** The formats a column or a fact may draw its value in. */
export const CELL_FORMATS = ["text", "number", "money", "date", "dateTime", "badge"] as const

/** One format of a cell. */
export type CellFormat = (typeof CELL_FORMATS)[number]

/** What formatting a value needs from the viewer and the block. */
export interface CellContext {
    /** The language tag of the viewer, as `Intl` takes it. */
    readonly locale: string
    /** The ISO 4217 code a money value is drawn in. */
    readonly currency: string
    /** The time zone a date-time is drawn in; absent draws it in the viewer's own. */
    readonly timeZone?: string | undefined
}

/** The money a block draws when its spec names none. */
export const DEFAULT_CURRENCY = "VND"

/** The context of a block: the viewer's language and the currency its spec names, or the default. */
export const cellContextOf = (locale: string, currency: string | undefined): CellContext => ({
    locale,
    currency: currency ?? DEFAULT_CURRENCY,
})

/** A date without a time: it names a day, so it is drawn in that day and never shifted by a zone. */
const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** The finite number a value carries, as a number or as numeric text; null for anything else. */
export const numberOf = (value: unknown): number | null => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (typeof value !== "string" || value.trim() === "") return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

/** The date a value names, as ISO text or as epoch milliseconds; null for anything else. */
const dateOf = (value: unknown): Date | null => {
    if (typeof value !== "string" && typeof value !== "number") return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

/** The number a value carries, drawn in the viewer's language; nothing for a value that is no number. */
const numberText = (value: unknown, context: CellContext, money: boolean): string => {
    const amount = numberOf(value)
    if (amount === null) return ""
    const options: Intl.NumberFormatOptions = money ? { style: "currency", currency: context.currency } : {}
    return new Intl.NumberFormat(context.locale, options).format(amount)
}

/** The day or the moment a value names, drawn in the viewer's language; nothing for a value that is no date. */
const dateText = (value: unknown, context: CellContext, withTime: boolean): string => {
    const date = dateOf(value)
    if (date === null) return ""
    const timeZone = typeof value === "string" && DAY_ONLY.test(value) ? "UTC" : context.timeZone
    const options: Intl.DateTimeFormatOptions = {
        dateStyle: "medium",
        ...(withTime ? { timeStyle: "short" as const } : {}),
        ...(timeZone === undefined ? {} : { timeZone }),
    }
    return new Intl.DateTimeFormat(context.locale, options).format(date)
}

/** The text a block draws for a value in the given format; a value that does not fit its format draws as nothing. */
export const formatValue = (value: unknown, format: CellFormat | undefined, context: CellContext): string => {
    switch (format) {
        case "number":
            return numberText(value, context, false)
        case "money":
            return numberText(value, context, true)
        case "date":
            return dateText(value, context, false)
        case "dateTime":
            return dateText(value, context, true)
        case "text":
        case "badge":
        case undefined:
            return textOf(value)
    }
}
