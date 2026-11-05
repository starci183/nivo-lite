import { textOf } from "../slots/paths"
import { formatValue, numberOf } from "./cell-format"
import type { CellContext } from "./cell-format"

/**
 * The formats a figure may draw its value in: a number with grouping, money in the block's currency, a percent (the value is a
 * fraction, so 0.25 draws as 25%) and a count (a whole number).
 */
export const FIGURE_FORMATS = ["number", "money", "percent", "count"] as const

/** One format of a figure. */
export type FigureFormat = (typeof FIGURE_FORMATS)[number]

/** The most fraction digits a percent keeps. */
const PERCENT_DIGITS = 1

/** The number a value carries, drawn in the viewer's language with the given options; nothing for a value that is no number. */
const intlText = (value: unknown, context: CellContext, options: Intl.NumberFormatOptions): string => {
    const amount = numberOf(value)
    return amount === null ? "" : new Intl.NumberFormat(context.locale, options).format(amount)
}

/**
 * The text a figure draws for its value. A figure with no format draws the value as text; a value that does not fit its format
 * draws as nothing. The block host has no number formatter, so the text is made with `Intl.NumberFormat` in the host's locale.
 */
export const figureTextOf = (value: unknown, format: FigureFormat | undefined, context: CellContext): string => {
    switch (format) {
        case "number":
        case "money":
            return formatValue(value, format, context)
        case "percent":
            return intlText(value, context, { style: "percent", maximumFractionDigits: PERCENT_DIGITS })
        case "count":
            return intlText(value, context, { maximumFractionDigits: 0 })
        case undefined:
            return textOf(value)
    }
}
