import type { LedgerEntry } from "../../vocabulary"
import type { OrderRow, TransactionRow } from "../payment/payment.schemas"

/** The code the NIVO MCP door fails a tool call with when the provider refused the connection (a missing scope, a 403): only the owner can cure it. */
export const CONNECTION_REFUSED_CODE = "GRAPH_NODES_TOOL_CONNECTION_REFUSED"

/** The offset of Vietnam from UTC, in milliseconds: the day a payment belongs to is the day on the shop's wall. */
const VIETNAM_OFFSET_MS = 7 * 3_600_000

/** How a settlement came out, as the settlement node reports it, plus the owner taking one back. */
export type LedgerResult = "paid" | "already-paid" | "raised" | "voided"

/** True when the result is one that put money against an order, so the ledger has something to record. */
export const isRecordable = (result: LedgerResult): boolean => result === "paid" || result === "already-paid"

/** The shop's calendar day of an instant, `YYYY-MM-DD`. */
export const dayOf = (instant: string): string => new Date(Date.parse(instant) + VIETNAM_OFFSET_MS).toISOString().slice(0, 10)

/** True when a failure is the door saying the provider refused the connection. */
export const isConnectionRefused = (error: unknown): boolean =>
    typeof error === "object" && error !== null && "code" in error && error.code === CONNECTION_REFUSED_CODE

/** The ledger entry of a transaction that paid an order: the customer is the lead's name, else the payer on the transfer. */
export const entryOf = (transaction: TransactionRow, order: OrderRow, leadName: string | null): LedgerEntry => ({
    date: dayOf(transaction.receivedAt),
    orderNo: order.orderNo,
    customer: leadName ?? transaction.counterpartName ?? "",
    amountVnd: transaction.amountVnd,
    transactionId: transaction.id,
    status: "paid",
    note: "",
})
