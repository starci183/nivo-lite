import { DAY_MS, shopDayOf } from "./shop-time"

/** The tax obligations the list knows: value added tax and the personal income tax the shop withholds. */
export type TaxKind = "vat" | "pit"

/** The kinds in the order the list shows them on one day. */
export const TAX_KINDS: ReadonlyArray<TaxKind> = ["vat", "pit"]

/** The day of the month both declarations fall due, for the month before. */
export const TAX_DUE_DAY = 20

/** How far ahead the list looks, in days. */
export const DUE_HORIZON_DAYS = 30

/** One obligation that falls due soon. */
export interface DueItem {
    /** The key of the row. */
    readonly id: string
    /** Which tax. */
    readonly kind: TaxKind
    /** The month the declaration is for, 1 to 12. */
    readonly month: number
    /** The day it falls due, `YYYY-MM-DD`. */
    readonly dueDay: string
    /** The days left, zero on the day itself. */
    readonly daysLeft: number
}

const two = (value: number): string => String(value).padStart(2, "0")

const dayStartMs = (day: string): number => Date.parse(`${day}T00:00:00.000Z`)

/**
 * The tax declarations that fall due within the next `horizon` days of the shop's calendar: on the 20th of each month the
 * declarations for the month before are due, so each month holds one of each kind. Soonest first, value added tax before the personal
 * income tax on the same day.
 */
export const dueSoonOf = (now: Date, horizon: number = DUE_HORIZON_DAYS): ReadonlyArray<DueItem> => {
    const today = shopDayOf(now.toISOString())
    const year = Number(today.slice(0, 4))
    const monthIndex = Number(today.slice(5, 7)) - 1
    const todayMs = dayStartMs(today)
    return [0, 1, 2].flatMap((ahead) => {
        const due = new Date(Date.UTC(year, monthIndex + ahead, TAX_DUE_DAY))
        const dueDay = `${due.getUTCFullYear()}-${two(due.getUTCMonth() + 1)}-${two(due.getUTCDate())}`
        const daysLeft = Math.round((due.getTime() - todayMs) / DAY_MS)
        const month = due.getUTCMonth() === 0 ? 12 : due.getUTCMonth()
        return daysLeft < 0 || daysLeft > horizon
            ? []
            : TAX_KINDS.map((kind): DueItem => ({ id: `${kind}-${dueDay}`, kind, month, dueDay, daysLeft }))
    })
}
