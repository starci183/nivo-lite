import type { NodeTools, RightsBoundData } from "@nivo-lite/agent-sdk/node"
import { messageOf } from "../../messages/catalog"
import type { MessageKey } from "../../messages/catalog"
import type { AccountingReportDifference, AccountingReportPayload } from "../../modules/accounting/agent-message-kinds"
import {
    RECONCILE_LOOKUP_MAX,
    closeKindOf,
    dayFiguresOf,
    dayWindowOf,
    daysOfMonthUpTo,
    reconcileMonth,
} from "../../rules/accounting/close-report"
import type {
    BankCredit,
    BookedCredit,
    CreditRow,
    DayFigures,
    DayWindow,
    DifferenceKind,
} from "../../rules/accounting/close-report"
import { shopDayOf } from "../../rules/accounting/shop-time"
import type { BankMovement, BankTransactionsResult } from "../../vocabulary"
import type { NodeLocale } from "../node-schema.types"
import { amountTextOf } from "../sales/order-notice.policy"
import { READ_CREDITS } from "./accounting.rights"

/**
 * What the close report reads with: the books (`bank-transaction`, under `READ_CREDITS`) and the bank itself (the `bank.transactions`
 * tool). The executor of the `accounting.close-report` tool hands its own reader and bank port; a node context fits as is.
 */
export interface CloseReportPorts {
    /** Reads the books. */
    readonly data: Pick<RightsBoundData, "read">
    /** Calls the `bank.transactions` tool. */
    readonly tools: NodeTools
}

/** One card to post to the team chat (`agent-message.post`), with the key that posts it once. */
export interface CloseReportPost {
    /** The `agent-message.post` payload: a `report.accounting` card. */
    readonly payload: {
        readonly kind: "report.accounting"
        readonly intent: "report"
        readonly title: string
        readonly summary: string
        readonly payload: AccountingReportPayload
    }
    /** Once per day (`accounting-daily:<day>`) or per month (`accounting-month:<yyyy-mm>`). */
    readonly dedupeKey: string
}

/** The close of one evening: which close it is and the cards to post, in order. */
export interface CloseReport {
    /** `daily`, or `month-end` on the last evening of the month (the daily card, then the reconciliation). */
    readonly kind: "daily" | "month-end"
    /** The cards. */
    readonly posts: ReadonlyArray<CloseReportPost>
}

const BANK_TOOL = "bank.transactions" as const

/** The most rows the bank answers for one window, and the most one read of the books answers. */
const BANK_PAGE = 50
const READ_PAGE = 100

/** The statuses of money in the books keep. */
const STATUSES: ReadonlyArray<string> = ["matched", "unmatched", "needs_review", "other_income"]

const FIELDS = READ_CREDITS.fields

/** A credit as the books give it. */
interface CreditRead {
    readonly amountVnd: number
    readonly occurredAt: string
    readonly orderId: string | null
    readonly status: string
    readonly externalRef: string | null
}

/** The books' credits of every status, newest first, and whether a status had more than one read can hold inside the period asked for. */
interface BookCredits {
    readonly rows: ReadonlyArray<CreditRow>
    readonly capped: boolean
}

const bookCredits = async (ports: CloseReportPorts, sinceDay: string): Promise<BookCredits> => {
    const lists = await Promise.all(
        STATUSES.map((status) =>
            ports.data.read<CreditRead>("bank-transaction", {
                where: { direction: "credit", status },
                fields: FIELDS,
                limit: READ_PAGE,
            }),
        ),
    )
    const capped = lists.some((list) => {
        const oldest = list.at(-1)
        return list.length >= READ_PAGE && oldest !== undefined && shopDayOf(oldest.occurredAt) >= sinceDay
    })
    return { rows: lists.flat(), capped }
}

/** What the bank lists for a window, split into money in and money out; null when the bank cannot be read. */
interface BankWindow {
    readonly credits: ReadonlyArray<BankMovement>
    readonly debits: ReadonlyArray<BankMovement>
    /** True when the bank answered as many rows as it can: there may be more. */
    readonly full: boolean
}

const bankWindow = async (ports: CloseReportPorts, window: DayWindow): Promise<BankWindow | null> => {
    try {
        const answer = await ports.tools.call<BankTransactionsResult>(BANK_TOOL, {
            since: window.since,
            until: window.until,
            limit: BANK_PAGE,
        })
        return {
            credits: answer.transactions.filter((movement) => movement.direction === "credit"),
            debits: answer.transactions.filter((movement) => movement.direction === "debit"),
            full: answer.transactions.length >= BANK_PAGE,
        }
    } catch {
        return null
    }
}

const sumOf = (movements: ReadonlyArray<BankMovement>): number =>
    movements.reduce((total, movement) => total + movement.amountVnd, 0)

/** `+20.000 ₫` or `-20.000 ₫`: a difference with its direction. */
const signedTextOf = (amountVnd: number, locale: NodeLocale): string =>
    `${amountVnd > 0 ? "+" : amountVnd < 0 ? "-" : ""}${amountTextOf(Math.abs(amountVnd), locale)}`

/** `09/11/2026` from `2026-11-09`. */
const dayTextOf = (day: string): string => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`

/** `11/2026` from `2026-11-09`. */
const monthTextOf = (day: string): string => `${day.slice(5, 7)}/${day.slice(0, 4)}`

const filled = (template: string, values: Readonly<Record<string, string>>): string =>
    Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), template)

const DIFFERENCE_WORDS: Readonly<Record<DifferenceKind, MessageKey>> = {
    missing: "accountingReportDiffMissing",
    waiting: "accountingReportDiffWaiting",
    amount_differs: "accountingReportDiffAmount",
}

const dailyPayload = (figures: DayFigures, partial: boolean, locale: NodeLocale): AccountingReportPayload => ({
    period: "daily",
    rows: [
        { label: messageOf(locale, "accountingReportIn"), value: amountTextOf(figures.inVnd, locale) },
        { label: messageOf(locale, "accountingReportPaidOrders"), value: String(figures.paidOrders) },
        {
            label: messageOf(locale, "accountingReportUnmatched"),
            value: `${String(figures.unmatchedCount)} · ${amountTextOf(figures.unmatchedVnd, locale)}`,
        },
        {
            label: messageOf(locale, "accountingReportDifference"),
            value:
                figures.differenceVnd === null
                    ? messageOf(locale, "accountingReportBankUnknown")
                    : signedTextOf(figures.differenceVnd, locale),
        },
    ],
    differences: [],
    notes: partial ? [messageOf(locale, "accountingReportPartial")] : [],
    partial,
})

/** The daily card, once for the day. */
const dailyPost = async (ports: CloseReportPorts, day: string, locale: NodeLocale): Promise<CloseReportPost> => {
    const books = await bookCredits(ports, day)
    const bank = await bankWindow(ports, dayWindowOf(day))
    const figures = dayFiguresOf(day, books.rows, bank === null ? null : sumOf(bank.credits))
    const partial = books.capped || bank?.full === true
    return {
        payload: {
            kind: "report.accounting",
            intent: "report",
            title: filled(messageOf(locale, "accountingReportDailyTitle"), { day: dayTextOf(day) }),
            summary: filled(messageOf(locale, "accountingReportSummary"), {
                in: amountTextOf(figures.inVnd, locale),
                paid: String(figures.paidOrders),
                unmatched: String(figures.unmatchedCount),
            }),
            payload: { ...dailyPayload(figures, partial, locale) },
        },
        dedupeKey: `accounting-daily:${day}`,
    }
}

/** What the bank lists over the days of a month up to a day; null when it cannot be read. */
interface MonthBank {
    readonly credits: ReadonlyArray<BankCredit>
    readonly debits: ReadonlyArray<BankMovement>
    readonly full: boolean
}

const monthBank = async (ports: CloseReportPorts, day: string): Promise<MonthBank | null> => {
    const credits: Array<BankCredit> = []
    const debits: Array<BankMovement> = []
    let full = false
    for (const one of daysOfMonthUpTo(day)) {
        const window = await bankWindow(ports, dayWindowOf(one))
        if (window === null) return null
        credits.push(
            ...window.credits.map((movement) => ({
                ref: movement.id,
                amountVnd: movement.amountVnd,
                occurredAt: movement.occurredAt,
            })),
        )
        debits.push(...window.debits)
        full = full || window.full
    }
    return { credits, debits, full }
}

/** What the books hold under each bank reference of the month: one lookup by the reference, so the month is never cut at a page. */
const bookedFor = async (
    ports: CloseReportPorts,
    credits: ReadonlyArray<BankCredit>,
): Promise<ReadonlyMap<string, BookedCredit | null>> => {
    const found = await Promise.all(
        credits.map(async (credit): Promise<readonly [string, BookedCredit | null]> => {
            const [row] = await ports.data.read<CreditRead>("bank-transaction", {
                where: { externalRef: credit.ref },
                fields: FIELDS,
                limit: 1,
            })
            return [credit.ref, row === undefined ? null : { amountVnd: row.amountVnd, status: row.status }]
        }),
    )
    return new Map(found)
}

const differenceLineOf = (
    difference: { kind: DifferenceKind; ref: string; occurredAt: string; bankVnd: number },
    locale: NodeLocale,
): AccountingReportDifference => ({
    label: messageOf(locale, DIFFERENCE_WORDS[difference.kind]),
    value: amountTextOf(difference.bankVnd, locale),
    detail: `${difference.ref} · ${dayTextOf(shopDayOf(difference.occurredAt))}`,
})

/** The month-end reconciliation of the bank against the ledger, once for the month. */
const monthEndPost = async (ports: CloseReportPorts, day: string, locale: NodeLocale): Promise<CloseReportPost> => {
    const bank = await monthBank(ports, day)
    const notes = [messageOf(locale, "accountingReportTaxNote")]
    const title = filled(messageOf(locale, "accountingReportMonthTitle"), { month: monthTextOf(day) })
    if (bank === null) {
        return {
            payload: {
                kind: "report.accounting",
                intent: "report",
                title,
                summary: messageOf(locale, "accountingReportBankUnknown"),
                payload: {
                    period: "month-end",
                    rows: [
                        {
                            label: messageOf(locale, "accountingReportBankIn"),
                            value: messageOf(locale, "accountingReportBankUnknown"),
                        },
                    ],
                    differences: [],
                    notes,
                    partial: true,
                },
            },
            dedupeKey: `accounting-month:${day.slice(0, 7)}`,
        }
    }
    const looked = bank.credits.slice(0, RECONCILE_LOOKUP_MAX)
    const partial = bank.full || bank.credits.length > looked.length
    const result = reconcileMonth(looked, await bookedFor(ports, looked))
    const rows = [
        { label: messageOf(locale, "accountingReportBankIn"), value: amountTextOf(result.bankInVnd, locale) },
        { label: messageOf(locale, "accountingReportLedgerIn"), value: amountTextOf(result.ledgerInVnd, locale) },
        { label: messageOf(locale, "accountingReportDifference"), value: signedTextOf(result.differenceVnd, locale) },
        ...(bank.debits.length === 0
            ? []
            : [
                  {
                      label: messageOf(locale, "accountingReportDebits"),
                      value: `${String(bank.debits.length)} · ${amountTextOf(sumOf(bank.debits), locale)}`,
                  },
              ]),
    ]
    return {
        payload: {
            kind: "report.accounting",
            intent: "report",
            title,
            summary: filled(messageOf(locale, "accountingReportSummary"), {
                in: amountTextOf(result.bankInVnd, locale),
                paid: String(looked.length - result.differences.length),
                unmatched: String(result.differences.length),
            }),
            payload: {
                period: "month-end",
                rows,
                differences: result.differences.slice(0, 50).map((one) => differenceLineOf(one, locale)),
                notes: [
                    ...(result.differences.length === 0 ? [messageOf(locale, "accountingReportNoDifference")] : []),
                    ...(partial ? [messageOf(locale, "accountingReportPartial")] : []),
                    ...notes,
                ],
                partial,
            },
        },
        dedupeKey: `accounting-month:${day.slice(0, 7)}`,
    }
}

/**
 * The evening close of the books for the clock slot it was fired for (epoch milliseconds): every evening the day's figures (money in,
 * orders paid, credits still unmatched, and the difference between what the bank says came in and what the books recorded); on the last
 * evening of the month the reconciliation too (the bank's total against the ledger's, every credit behind the gap listed). The bank's
 * side is read from the bank day by day, the books' side looked up by bank reference, so a long month is never cut at a page. A bank that
 * cannot be read is said so, never guessed; what could not be checked is marked provisional; VAT notes are guidance text only.
 * Deterministic: the body of the `accounting.close-report` tool, whose executor posts each card under its key.
 */
export const closeReportOf = async (ports: CloseReportPorts, slotMs: number, locale: NodeLocale): Promise<CloseReport> => {
    const day = shopDayOf(new Date(slotMs).toISOString())
    const kind = closeKindOf(slotMs)
    const daily = await dailyPost(ports, day, locale)
    return { kind, posts: kind === "month-end" ? [daily, await monthEndPost(ports, day, locale)] : [daily] }
}
