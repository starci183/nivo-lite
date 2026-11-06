import { DAY_MS, shopDayOf } from "./shop-time"
import type { VatPeriod } from "./settings"

/** The tax obligations the list knows: value added tax and the personal income tax the shop withholds. */
export type TaxKind = "vat" | "pit"

/** The kinds in the order the list shows them on one day. */
export const TAX_KINDS: ReadonlyArray<TaxKind> = ["vat", "pit"]

/** The day of the month a declaration falls due. */
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

const dayStartMs = (day: string): number => Date.parse(`${day}T00:00:00.000Z`)

/** The months (0 to 11) whose 20th a quarterly value added tax declaration falls due: the middle month of each quarter, which names that quarter. */
const QUARTER_DUE_MONTHS: ReadonlyArray<number> = [1, 4, 7, 10]

/**
 * The tax declarations that fall due within the next `horizon` days of the shop calendar. On the 20th of each month the personal
 * income tax withheld for the month before is due, and value added tax is due the same day: for the month before when the shop files
 * monthly, and, when it files quarterly, on the 20th of the middle month of the quarter, for that quarter. Soonest first, value added
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
    const todayMs = dayStartMs(today)
    return [0, 1, 2].flatMap((ahead) => {
        const due = new Date(Date.UTC(year, monthIndex + ahead, TAX_DUE_DAY))
        const dueDay = `${due.getUTCFullYear()}-${two(due.getUTCMonth() + 1)}-${two(due.getUTCDate())}`
        const daysLeft = Math.round((due.getTime() - todayMs) / DAY_MS)
        if (daysLeft < 0 || daysLeft > horizon) return []
        const before = due.getUTCMonth() === 0 ? 12 : due.getUTCMonth()
        const vat: ReadonlyArray<DueItem> =
            vatPeriod === "monthly"
                ? [{ id: `vat-${dueDay}`, kind: "vat", unit: "month", period: before, dueDay, daysLeft }]
                : QUARTER_DUE_MONTHS.includes(due.getUTCMonth())
                  ? [
                        {
                            id: `vat-${dueDay}`,
                            kind: "vat",
                            unit: "quarter",
                            period: Math.floor(due.getUTCMonth() / 3) + 1,
                            dueDay,
                            daysLeft,
                        },
                    ]
                  : []
        return [...vat, { id: `pit-${dueDay}`, kind: "pit", unit: "month", period: before, dueDay, daysLeft }]
    })
}
