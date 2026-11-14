import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { ledgerLineOf, otherIncomeLineOf } from "../../../rules/sales/ledger/posting"
import type { LedgerEntry } from "../../../vocabulary/tools"
import { leadNameOfContact, orderById, transactionById } from "./accounting-data"

/** The records a ledger line is built from. */
export interface LedgerEntryPorts {
    /** The payments. */
    readonly transactions: EntityApi
    /** The orders. */
    readonly orders: EntityApi
    /** The customers. */
    readonly leads: EntityApi
}

/** The ledger line of a transaction, or why it has none. */
export type LedgerEntryOf =
    | { readonly entry: LedgerEntry }
    | { readonly refused: "transaction_missing" | "transaction_not_settled" }

/**
 * The line of the business ledger of one bank transaction, built from the records alone: the transaction (date, amount, transfer
 * content, payer), the order it paid (its number) and the customer of that order. A caller names the transaction; it types no date,
 * amount or name. A transaction that paid an order is a sale; one the owner classified as other income is a line without an order; a
 * transaction that paid nothing yet has no line.
 */
export const ledgerEntryOf = async (ports: LedgerEntryPorts, transactionId: string): Promise<LedgerEntryOf> => {
    const transaction = await transactionById(ports.transactions, transactionId)
    if (transaction === null) return { refused: "transaction_missing" }
    if (transaction.orderId === null) {
        return transaction.status === "other_income"
            ? { entry: otherIncomeLineOf(transaction) }
            : { refused: "transaction_not_settled" }
    }
    const order = await orderById(ports.orders, transaction.orderId)
    if (order === null) return { refused: "transaction_not_settled" }
    const leadName = await leadNameOfContact(ports.leads, order.contactId)
    return { entry: ledgerLineOf(transaction, order, leadName) }
}
