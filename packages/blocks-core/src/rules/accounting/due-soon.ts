import { DAY_MS, shopDayOf } from "./shop-time"
import type { VatPeriod } from "./settings"

/** The tax obligations the list knows: value added tax and the personal income tax the shop withholds. */
export type TaxKind = "vat" | "pit"

/** The kinds in the order the list shows them on one day. */
export const TAX_KINDS: ReadonlyArray<TaxKind> = ["vat", "pit"]

/** The day of the month a monthly declaration falls due: the 20th of the month after the one it covers. */
export const TAX_DUE_DAY = 20

/** How far ahead the list looks, in days. */
export const DUE_HORIZON_DAYS = 30

/** What a declaration covers: a month or a quarter of the year. */
export type DuePeriodUnit = "month" | "quarter"

/** One obligation that falls due soon. */
export interface DueItem {
    /** The key of the row. */
    readonly id: string
    /** Which tax. */
    readonly kind: TaxKind
    /** Whether the declaration covers a month or a quarter. */
    readonly unit: DuePeriodUnit
    /** The number of the month (1 to 12) or of the quarter (1 to 4) the declaration is for. */
    readonly period: number
    /** The day it falls due, `YYYY-MM-DD`. */
    readonly dueDay: string
    /** The days left, zero on the day itself. */
    readonly daysLeft: number
}

const two = (value: number): string => String(value).padStart(2, "0")

const dayOf = (date: Date): string =>
    `${date.getUTCFullYear()}-${two(date.getUTCMonth() + 1)}-${two(date.getUTCDate())}`

/** The months ahead of the current one that are looked at: enough to cover the horizon. */
const MONTHS_AHEAD: ReadonlyArray<number> = [0, 1, 2, 3]

/**
 * The tax declarations that fall due within the next `horizon` days of the shop calendar, by Vietnamese law. The personal income tax
 * withheld for a month is due on the 20th of the month after it. Value added tax is due on the 20th of the month after the month it
 * covers for a shop that files monthly, and, for a shop that files quarterly, on the last day of the first month of the quarter after:
 * the fourth quarter on 31 January, the first on 30 April, the second on 31 July, the third on 31 October. Soonest first, value added
 * tax before the personal income tax on the same day.
 */
export const dueSoonOf = (
    now: Date,
    vatPeriod: VatPeriod,
    horizon: number = DUE_HORIZON_DAYS,
): ReadonlyArray<DueItem> => {
    const today = shopDayOf(now.toISOString())
    const year = Number(today.slice(0, 4))
    const monthIndex = Number(today.slice(5, 7)) - 1
    const todayMs = Date.parse(`${today}T00:00:00.000Z`)
    const item = (kind: TaxKind, unit: DuePeriodUnit, period: number, due: Date): ReadonlyArray<DueItem> => {
        const daysLeft = Math.round((due.getTime() - todayMs) / DAY_MS)
        return daysLeft < 0 || daysLeft > horizon
            ? []
            : [{ id: `${kind}-${dayOf(due)}`, kind, unit, period, dueDay: dayOf(due), daysLeft }]
    }
    return MONTHS_AHEAD.flatMap((ahead) => {
        const month = monthIndex + ahead
        const dueMonth = ((month % 12) + 12) % 12
        const twentieth = new Date(Date.UTC(year, month, TAX_DUE_DAY))
        const before = dueMonth === 0 ? 12 : dueMonth
        const quarterly =
            vatPeriod === "quarterly" && dueMonth % 3 === 0
                ? item("vat", "quarter", dueMonth === 0 ? 4 : dueMonth / 3, new Date(Date.UTC(year, month + 1, 0)))
                : []
        const vat = vatPeriod === "monthly" ? item("vat", "month", before, twentieth) : quarterly
        return [...vat, ...item("pit", "month", before, twentieth)]
    }).toSorted(
        (left, right) =>
            left.dueDay.localeCompare(right.dueDay) || TAX_KINDS.indexOf(left.kind) - TAX_KINDS.indexOf(right.kind),
    )
}
