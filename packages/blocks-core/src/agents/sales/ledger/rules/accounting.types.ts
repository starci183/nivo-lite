import type { EntryStatus } from "./entry-status"

/** Where a bank transaction stands against what it paid. */
export type TransactionStatus = "unmatched" | "matched" | "needs_review" | "other_income"

/** Money in (`credit`) or out (`debit`) of the workspace's account. */
export type TransactionDirection = "credit" | "debit"

/** A payment transaction as the accounting rules read it (entity `blocks-core.sales.transaction`; the order link is joined by the provider). */
export interface TransactionRecord {
    /** The record id. */
    readonly id: string
    /** The version token an update must present. */
    readonly version: string
    /** The money, in VND. */
    readonly amountVnd: number
    /** Money in or out. */
    readonly direction: TransactionDirection
    /** The transfer content the bank recorded. */
    readonly reference: string | null
    /** The name of the payer. */
    readonly payer: string | null
    /** When the money moved, ISO text. */
    readonly occurredAt: string
    /** Where the transaction stands. */
    readonly status: TransactionStatus
    /** The order the transaction paid; null while it paid none. */
    readonly orderId: string | null
    /** The connected account the money arrived on; absent or null in records from before accounts were kept. */
    readonly connectionId?: string | null | undefined
    /** The bank's own reference of the movement (the provider transaction id): the one key of a ledger line; absent in older records. */
    readonly externalRef?: string | null | undefined
}

/** The statuses of a sales order. */
export type OrderStatus = "draft" | "confirmed" | "invoiced" | "paid" | "cancelled"

/** A sales order as the accounting rules read it (entity `blocks-core.sales.order`; the lead link is joined by the provider). */
export interface OrderRecord {
    /** The record id. */
    readonly id: string
    /** The version token an update must present. */
    readonly version: string
    /** The number the customer is told. */
    readonly orderNo: string
    /** The amount due, in VND; null for an order not priced yet. */
    readonly amountVnd: number | null
    /** Where the order stands. */
    readonly status: OrderStatus
    /** The person the order is for (the core contact). */
    readonly contactId: string | null
}

/** The statuses of a customer's payment claim. */
export type ClaimStatus = "open" | "settled" | "escalated" | "withdrawn"

/** A customer's word that they paid (entity `blocks-core.sales.claim`; the order link is joined by the provider). */
export interface ClaimRecord {
    /** The record id. */
    readonly id: string
    /** The version token an update must present. */
    readonly version: string
    /** The amount the customer said, in VND. */
    readonly amountVnd: number | null
    /** Where the claim stands. */
    readonly status: ClaimStatus
    /** The order the claim names. */
    readonly orderId: string | null
    /** The transaction that settled the claim. */
    readonly settledTransactionId: string | null
    /** The conversation the claim came in. */
    readonly conversationId: string | null
    /** The person who said they paid (the core contact); null when the claim came from a visitor not yet known. */
    readonly contactId: string | null
}

/** The statuses of an invoice. */
export type InvoiceStatus = "draft" | "issued" | "paid" | "void"

/** An invoice as the accounting rules read it (entity `blocks-core.sales.invoice`). */
export interface InvoiceRecord {
    /** The record id. */
    readonly id: string
    /** The number printed on the invoice. */
    readonly invoiceNo: string
    /** The person billed (the core contact); null when unknown. */
    readonly contactId: string | null
    /** The amount, in VND. */
    readonly amountVnd: number
    /** Where the invoice stands. */
    readonly status: InvoiceStatus
    /** When the invoice falls due, ISO text. */
    readonly dueAt: string | null
    /** When the invoice was issued, ISO text. */
    readonly issuedAt: string | null
    /** When the invoice was paid, ISO text. */
    readonly paidAt: string | null
    /** When the record was created, ISO text. */
    readonly createdAt: string
    /** The customer's name; null when unknown. */
    readonly customer: string | null
}

/** What a correction points at. */
export type AdjustmentTarget = "invoice" | "transaction"

/** A correction an accountant recorded (entity `blocks-core.sales.ledger-adjustment`). */
export interface AdjustmentRecord {
    /** The record id. */
    readonly id: string
    /** The kind of record corrected. */
    readonly targetType: AdjustmentTarget
    /** The record corrected. */
    readonly targetId: string
    /** The accountant's note. */
    readonly note: string
    /** The amount the record should have had, in VND; null when only a note. */
    readonly correctedAmountVnd: number | null
    /** Who recorded the correction. */
    readonly createdBy: string
    /** When it was recorded, ISO text. */
    readonly createdAt: string
}

/** What a book entry records: money in, money out, an invoice issued, the reversal of a voided one, a correction. */
export type BookEntryKind = "income" | "expense" | "invoice" | "reversal" | "adjustment"

/** The values of a book entry (entity `blocks-core.sales.ledger-entry`, a projection written by declared jobs only). */
export interface BookEntryValues {
    /** What the entry records. */
    readonly kind: BookEntryKind
    /** The entity of the row the entry comes from. */
    readonly sourceEntity: string
    /** The row the entry comes from. */
    readonly sourceId: string
    /** The shop's calendar day of the entry, `YYYY-MM-DD`. */
    readonly entryDate: string
    /** The amount, in VND. */
    readonly amountVnd: number
    /** A short note; null when there is none. */
    readonly note: string | null
    /** The customer or supplier the entry is with, for the second line of its row; null when unknown. */
    readonly counterparty: string | null
    /** Where the entry stands for the person reading the books. */
    readonly status: EntryStatus
}

/** One book entry as a read yields it. */
export interface BookEntryRecord extends BookEntryValues {
    /** The record id. */
    readonly id: string
    /** The version token. */
    readonly version: string
}
