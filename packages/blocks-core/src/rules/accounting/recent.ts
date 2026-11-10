import { logoOf } from "../../rows/provider-logos"
import type { TransactionRecord } from "./accounting.types"
import { DAY_MS, SHOP_OFFSET_MS } from "./shop-time"

/** A payment with the account it came in on. */
export interface RecentPayment {
    /** The payment. */
    readonly payment: TransactionRecord
    /** The account the money reached, as the bank wrote it; null when it did not say. */
    readonly account: string | null
}

/** A connection the agent reads bank payments through, and what it may do through it. */
export interface BankConnection {
    /** The provider (`sepay`, `casso`). */
    readonly provider: string
    /** The name the connection is shown under. */
    readonly name: string
    /** The masked account of the connection; null when it has none. */
    readonly accountMasked: string | null
    /** What the agent may do through it: `read`, `ask` or `auto`. */
    readonly access: string
}

/** The words of a row of recent work, which leave the read as text. */
export interface RecentWords {
    /** A payment tied to an order, with its amount filled in. */
    readonly matched: (amount: string) => string
    /** A payment nobody tied to an order. */
    readonly unmatched: (amount: string) => string
    /** A payment the owner called other income. */
    readonly otherIncome: (amount: string) => string
}

/** One row of recent work: what happened, through which connection and at what level. */
export interface RecentRow {
    /** The payment. */
    readonly id: string
    /** The time of day, or the day when it is not today. */
    readonly time: string
    /** What happened, in the words of the viewer. */
    readonly title: string
    /** The connection it came through; empty when none is known. */
    readonly connection: string
    /** The source of the logo of the connection; empty when it has none. */
    readonly logo: string
    /** What the agent may do through that connection (`read`, `ask`, `auto`); empty when no connection is known. */
    readonly level: string
    /** Where the item stands: `done`, or `waiting` for the owner. */
    readonly status: "done" | "waiting"
}

const VND = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 })

const two = (value: number): string => String(value).padStart(2, "0")

/** The digits an account ends in: the last four, which is what a masked account keeps. */
const tailOf = (account: string | null): string => (account ?? "").replace(/\D/gu, "").slice(-4)

/** The time of a payment on the shop wall: `HH:mm` on the day of `now`, else `dd/MM`. */
export const timeOf = (occurredAt: string, now: Date): string => {
    const at = new Date(Date.parse(occurredAt) + SHOP_OFFSET_MS)
    const today = Math.floor((now.getTime() + SHOP_OFFSET_MS) / DAY_MS)
    return Math.floor(at.getTime() / DAY_MS) === today
        ? `${two(at.getUTCHours())}:${two(at.getUTCMinutes())}`
        : `${two(at.getUTCDate())}/${two(at.getUTCMonth() + 1)}`
}

/**
 * The connection a payment came through: the one whose masked account ends like the account of the payment; failing that, the only
 * connection there is. With several and no match, none is named.
 */
export const connectionOf = (
    account: string | null,
    connections: ReadonlyArray<BankConnection>,
): BankConnection | null => {
    const tail = tailOf(account)
    const matching = tail === "" ? undefined : connections.find((one) => tailOf(one.accountMasked) === tail)
    if (matching !== undefined) return matching
    return connections.length === 1 ? (connections[0] ?? null) : null
}

const titleOf = (payment: TransactionRecord, words: RecentWords): string => {
    const amount = `+${VND.format(Math.round(payment.amountVnd))}`
    if (payment.status === "matched") return words.matched(amount)
    return payment.status === "other_income" ? words.otherIncome(amount) : words.unmatched(amount)
}

/** The rows of recent work: each payment with the connection it came through and the level the agent holds on it. */
export const recentRowsOf = (
    payments: ReadonlyArray<RecentPayment>,
    connections: ReadonlyArray<BankConnection>,
    words: RecentWords,
    now: Date,
): ReadonlyArray<RecentRow> =>
    payments.map(({ payment, account }) => {
        const connection = connectionOf(account, connections)
        return {
            id: payment.id,
            time: timeOf(payment.occurredAt, now),
            title: titleOf(payment, words),
            connection: connection?.name ?? "",
            logo: logoOf(connection?.provider) ?? "",
            level: connection?.access ?? "",
            status: payment.status === "unmatched" || payment.status === "needs_review" ? "waiting" : "done",
        }
    })
