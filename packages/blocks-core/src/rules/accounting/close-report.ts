import { DAY_MS, SHOP_OFFSET_MS, shopDayOf } from "./shop-time"

/** The statuses of a bank movement as the books keep it. */
export type MovementStatus = "unmatched" | "matched" | "needs_review" | "other_income"

/** The statuses whose money has a line in the ledger: it was tied to an order, or the owner called it other income. */
const BOOKED: ReadonlyArray<string> = ["matched", "other_income"]

/** The statuses of money in that still waits for the owner. */
const WAITING: ReadonlyArray<string> = ["unmatched", "needs_review"]

/** One credit (money in) the books know, with the day it belongs to on the shop's wall. */
export interface CreditRow {
    /** The amount in VND. */
    readonly amountVnd: number
    /** When the money moved, ISO text. */
    readonly occurredAt: string
    /** Where it stands. */
    readonly status: string
    /** The order it paid; null while it paid none. */
    readonly orderId: string | null
}

/** What the day's report says. */
export interface DayFigures {
    /** The shop's calendar day, `YYYY-MM-DD`. */
    readonly day: string
    /** Money in recorded that day, every status. */
    readonly inVnd: number
    /** How many credits that is. */
    readonly creditCount: number
    /** How many orders the day's credits paid. */
    readonly paidOrders: number
    /** How many credits still wait for the owner, and how much they add up to. */
    readonly unmatchedCount: number
    readonly unmatchedVnd: number
    /** What the bank itself says came in that day; null when the bank cannot be asked. */
    readonly bankInVnd: number | null
    /** The bank's total minus the recorded total (positive: the bank holds money NIVO never saw); null when the bank cannot be asked. */
    readonly differenceVnd: number | null
}

/** The first and last instant of a shop day, as ISO text: `since` is its first millisecond, `until` its last. */
export interface DayWindow {
    readonly since: string
    readonly until: string
}

/** The shop day that starts the given day's window: the window of one day on the shop's wall, `[00:00, 24:00)` as the bank reads it. */
export const dayWindowOf = (day: string): DayWindow => {
    const start = Date.parse(`${day}T00:00:00.000Z`) - SHOP_OFFSET_MS
    return { since: new Date(start).toISOString(), until: new Date(start + DAY_MS - 1).toISOString() }
}

/** The shop days from the first of a month up to and including the given day, `YYYY-MM-DD`, oldest first. */
export const daysOfMonthUpTo = (day: string): ReadonlyArray<string> => {
    const last = Number(day.slice(8, 10))
    const month = day.slice(0, 8)
    return Array.from({ length: last }, (_, index) => `${month}${String(index + 1).padStart(2, "0")}`)
}

/** The shop day after the given one. */
export const nextDayOf = (day: string): string => shopDayOf(new Date(Date.parse(`${day}T12:00:00.000Z`) + DAY_MS).toISOString())

/** What a close run is: the daily report, or the daily report followed by the month's reconciliation on the last day of the month. */
export type CloseKind = "daily" | "month-end"

/** The kind of close a clock slot (epoch milliseconds, as the schedule gives it) is: month-end when the next shop day is the first. */
export const closeKindOf = (slotMs: number): CloseKind =>
    nextDayOf(shopDayOf(new Date(slotMs).toISOString())).endsWith("-01") ? "month-end" : "daily"

/** The day figures from the credits the books hold: only the credits of that shop day count. */
export const dayFiguresOf = (day: string, rows: ReadonlyArray<CreditRow>, bankInVnd: number | null): DayFigures => {
    const today = rows.filter((row) => shopDayOf(row.occurredAt) === day)
    const sum = (list: ReadonlyArray<CreditRow>): number => list.reduce((total, row) => total + row.amountVnd, 0)
    const waiting = today.filter((row) => WAITING.includes(row.status))
    const inVnd = sum(today)
    return {
        day,
        inVnd,
        creditCount: today.length,
        paidOrders: today.filter((row) => row.status === "matched" && row.orderId !== null).length,
        unmatchedCount: waiting.length,
        unmatchedVnd: sum(waiting),
        bankInVnd,
        differenceVnd: bankInVnd === null ? null : bankInVnd - inVnd,
    }
}

/** One credit the bank lists. */
export interface BankCredit {
    /** The bank's own reference of the movement (the provider transaction id). */
    readonly ref: string
    /** The amount in VND. */
    readonly amountVnd: number
    /** When the bank booked it, ISO text. */
    readonly occurredAt: string
}

/** What the books hold under a bank reference; null when nothing. */
export interface BookedCredit {
    /** The amount in VND. */
    readonly amountVnd: number
    /** Where it stands. */
    readonly status: string
}

/** Why a bank credit is not in the ledger as the bank has it. */
export type DifferenceKind = "missing" | "waiting" | "amount_differs"

/** One credit the bank has and the ledger does not have as the bank does. */
export interface ReconciliationDifference {
    /** Why. */
    readonly kind: DifferenceKind
    /** The bank reference. */
    readonly ref: string
    /** When the bank booked it, ISO text. */
    readonly occurredAt: string
    /** What the bank says. */
    readonly bankVnd: number
    /** What the books hold under the reference; null when nothing. */
    readonly bookVnd: number | null
}

/** The month-end reconciliation of the bank against the ledger. */
export interface MonthReconciliation {
    /** What the bank says came in over the month. */
    readonly bankInVnd: number
    /** What the ledger holds for those credits: the ones tied to an order or called other income. */
    readonly ledgerInVnd: number
    /** The bank's total minus the ledger's total. */
    readonly differenceVnd: number
    /** The credits behind the difference, oldest first. */
    readonly differences: ReadonlyArray<ReconciliationDifference>
}

const differenceOf = (credit: BankCredit, booked: BookedCredit | null): ReconciliationDifference | null => {
    if (booked === null) return { kind: "missing", ref: credit.ref, occurredAt: credit.occurredAt, bankVnd: credit.amountVnd, bookVnd: null }
    if (!BOOKED.includes(booked.status)) {
        return { kind: "waiting", ref: credit.ref, occurredAt: credit.occurredAt, bankVnd: credit.amountVnd, bookVnd: booked.amountVnd }
    }
    return booked.amountVnd === credit.amountVnd
        ? null
        : { kind: "amount_differs", ref: credit.ref, occurredAt: credit.occurredAt, bankVnd: credit.amountVnd, bookVnd: booked.amountVnd }
}

/**
 * Reconciles the bank's credits of a month with what the books hold under the same bank references. The ledger total counts only what has
 * a ledger line (tied to an order, or called other income); a credit missing from the books, one still waiting for the owner and one booked
 * for another amount are the differences. Nothing is guessed or corrected: it only lists.
 */
export const reconcileMonth = (
    bank: ReadonlyArray<BankCredit>,
    booked: ReadonlyMap<string, BookedCredit | null>,
): MonthReconciliation => {
    const differences = bank
        .flatMap((credit) => differenceOf(credit, booked.get(credit.ref) ?? null) ?? [])
        .toSorted((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    const bankInVnd = bank.reduce((total, credit) => total + credit.amountVnd, 0)
    const ledgerInVnd = bank.reduce((total, credit) => {
        const one = booked.get(credit.ref) ?? null
        return one !== null && BOOKED.includes(one.status) ? total + one.amountVnd : total
    }, 0)
    return { bankInVnd, ledgerInVnd, differenceVnd: bankInVnd - ledgerInVnd, differences }
}

/** The most credits a month-end run looks up one by one in the books; a month with more is reported as partial, never as complete. */
export const RECONCILE_LOOKUP_MAX = 400
