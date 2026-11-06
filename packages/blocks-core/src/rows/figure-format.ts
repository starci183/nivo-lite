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

/** How a figures block draws its items: tiles in one card, bars on one scale, or one proportional gauge per item. */
export const FIGURE_KINDS = ["tiles", "bars", "proportion"] as const

/** One kind of figures block. */
export type FigureKind = (typeof FIGURE_KINDS)[number]

/** One measured item of a chart: its label, its number and how the number reads. */
export interface ChartPoint {
    /** The key the chart draws the item under. */
    readonly id: string
    /** What the item is, drawn with it. */
    readonly label: string
    /** The measured amount, never negative. */
    readonly value: number
    /** How the amount reads, in the viewer's language. */
    readonly valueLabel: string
}

/** The point a chart draws for one item: a value that is no number draws as zero, with the text the format made. */
export const chartPointOf = (id: string, label: string, raw: unknown, valueLabel: string): ChartPoint => ({
    id,
    label,
    value: Math.max(numberOf(raw) ?? 0, 0),
    valueLabel,
})

/** The scale the gauges of a proportion share: the sum of the items, never less than one so the gauge keeps a range. */
export const proportionTotal = (points: ReadonlyArray<ChartPoint>): number =>
    Math.max(
        points.reduce((sum, point) => sum + point.value, 0),
        1,
    )
