import type { BookEntryKind, BookEntryRecord } from "./accounting.types"

/** The entries that put money into the till. */
export const CASH_IN_KINDS: ReadonlyArray<BookEntryKind> = ["income"]

/** The entries that take money out of the till: an expense, and the reversal of money that was taken in. */
export const CASH_OUT_KINDS: ReadonlyArray<BookEntryKind> = ["expense", "reversal"]

/** The kinds the cash book lists: invoices and corrections move no money. */
export const CASH_KINDS: ReadonlyArray<BookEntryKind> = [...CASH_IN_KINDS, ...CASH_OUT_KINDS]

/** The first day the books can hold, for the opening balance of a period (everything before it). */
export const LEDGER_EPOCH_DAY = "1970-01-01"

/** One line of the cash book: the money in or out of one entry and the balance after it. */
export interface LedgerLine {
    /** The entry id. */
    readonly id: string
    /** What the entry is called; empty when it has no note. */
    readonly title: string
    /** The kind of the entry, for its second line. */
    readonly kind: BookEntryKind
    /** The money in, in VND; zero for a line that took money out. */
    readonly inVnd: number
    /** The money out, in VND; zero for a line that took money in. */
    readonly outVnd: number
    /** The balance after this line, in VND. */
    readonly balanceVnd: number
}

/** The lines of one shop day with the money of the day and the balance at its end. */
export interface LedgerDay {
    /** The day, `YYYY-MM-DD`. */
    readonly day: string
    /** The lines of the day in the order they were booked. */
    readonly lines: ReadonlyArray<LedgerLine>
    /** The money in over the day. */
    readonly inVnd: number
    /** The money out over the day. */
    readonly outVnd: number
    /** The balance at the end of the day. */
    readonly balanceVnd: number
}

/** The cash book of a period: the opening and closing balance and the days between. */
export interface Ledger {
    /** The balance before the first day. */
    readonly openingVnd: number
    /** The money in over the period. */
    readonly inVnd: number
    /** The money out over the period. */
    readonly outVnd: number
    /** The balance after the last day. */
    readonly closingVnd: number
    /** The days that hold a line, oldest first. */
    readonly days: ReadonlyArray<LedgerDay>
}

/** The totals of entries before a period, by kind. */
export interface KindSum {
    /** The kind. */
    readonly kind: BookEntryKind
    /** The sum, in VND. */
    readonly vnd: number
}

/** The money of one kind as it moves the balance: in is plus, out is minus, anything else moves nothing. */
const signedVnd = (total: KindSum): number => {
    if (CASH_IN_KINDS.includes(total.kind)) return total.vnd
    return CASH_OUT_KINDS.includes(total.kind) ? -total.vnd : 0
}

/** The balance the entries before a period left: the money in less the money out. */
export const openingOf = (before: ReadonlyArray<KindSum>): number =>
    before.reduce((sum, total) => sum + signedVnd(total), 0)

/**
 * The cash book of a period: each entry of the period that moved money (oldest first) becomes a line with the balance after it,
 * the lines are grouped by day, and the closing balance is the opening one plus the money in less the money out.
 */
export const ledgerOf = (openingVnd: number, entries: ReadonlyArray<BookEntryRecord>): Ledger => {
    const moved = entries.filter((entry) => CASH_KINDS.includes(entry.kind))
    const days: Array<LedgerDay> = []
    let balance = openingVnd
    for (const entry of moved) {
        const isIn = CASH_IN_KINDS.includes(entry.kind)
        balance += isIn ? entry.amountVnd : -entry.amountVnd
        const line: LedgerLine = {
            id: entry.id,
            title: entry.note ?? "",
            kind: entry.kind,
            inVnd: isIn ? entry.amountVnd : 0,
            outVnd: isIn ? 0 : entry.amountVnd,
            balanceVnd: balance,
        }
        const last = days.at(-1)
        if (last?.day === entry.entryDate)
            days[days.length - 1] = {
                ...last,
                lines: [...last.lines, line],
                inVnd: last.inVnd + line.inVnd,
                outVnd: last.outVnd + line.outVnd,
                balanceVnd: balance,
            }
        else
            days.push({
                day: entry.entryDate,
                lines: [line],
                inVnd: line.inVnd,
                outVnd: line.outVnd,
                balanceVnd: balance,
            })
    }
    const inVnd = days.reduce((sum, day) => sum + day.inVnd, 0)
    const outVnd = days.reduce((sum, day) => sum + day.outVnd, 0)
    return { openingVnd, inVnd, outVnd, closingVnd: openingVnd + inVnd - outVnd, days }
}
