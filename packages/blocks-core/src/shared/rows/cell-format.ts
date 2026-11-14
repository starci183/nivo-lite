import { textOf } from "../slots/paths"
import type { Relabel } from "./value-labels"

/** The formats a column or a fact may draw its value in. */
export const CELL_FORMATS = ["text", "number", "money", "date", "day", "dateTime", "badge"] as const

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
    /** The words of the raw values a text or badge cell holds; absent draws them as they are. */
    readonly label?: Relabel | undefined
}

/** The money a block draws when its spec names none. */
export const DEFAULT_CURRENCY = "VND"

/** The context of a block: the viewer's language, the currency its spec names (or the default) and the words of its raw values. */
export const cellContextOf = (locale: string, currency: string | undefined, label?: Relabel): CellContext => ({
    locale,
    currency: currency ?? DEFAULT_CURRENCY,
    ...(label === undefined ? {} : { label }),
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

/** How a date is drawn: the whole day, the day and month only, or the day with the time. */
type DateStyle = "day" | "short" | "time"

/** The `Intl` options of each date style. */
const DATE_STYLES: Readonly<Record<DateStyle, Intl.DateTimeFormatOptions>> = {
    day: { dateStyle: "medium" },
    short: { day: "2-digit", month: "2-digit" },
    time: { dateStyle: "medium", timeStyle: "short" },
}

/** The day or the moment a value names, drawn in the viewer's language; nothing for a value that is no date. */
const dateText = (value: unknown, context: CellContext, style: DateStyle): string => {
    const date = dateOf(value)
    if (date === null) return ""
    const timeZone = typeof value === "string" && DAY_ONLY.test(value) ? "UTC" : context.timeZone
    const options: Intl.DateTimeFormatOptions = {
        ...DATE_STYLES[style],
        ...(timeZone === undefined ? {} : { timeZone }),
    }
    const format = new Intl.DateTimeFormat(context.locale, options)
    if (style !== "short") return format.format(date)
    return format
        .formatToParts(date)
        .filter((part) => part.type === "day" || part.type === "month")
        .map((part) => part.value)
        .join("/")
}

/** The text a block draws for a value in the given format; a value that does not fit its format draws as nothing. */
export const formatValue = (value: unknown, format: CellFormat | undefined, context: CellContext): string => {
    switch (format) {
        case "number":
            return numberText(value, context, false)
        case "money":
            return numberText(value, context, true)
        case "date":
            return dateText(value, context, "day")
        case "day":
            return dateText(value, context, "short")
        case "dateTime":
            return dateText(value, context, "time")
        case "text":
        case "badge":
        case undefined:
            return textOf(value)
    }
}

/** The text of the value at a path: as `formatValue` draws it, with the words the context gives a raw text or badge value. */
export const cellTextOf = (
    value: unknown,
    format: CellFormat | undefined,
    path: string,
    context: CellContext,
): string => {
    const text = formatValue(value, format, context)
    const isRaw = format === undefined || format === "text" || format === "badge"
    return isRaw && context.label !== undefined ? context.label(path, text) : text
}
