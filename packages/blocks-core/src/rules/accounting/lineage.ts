import type { AdjustmentRecord, InvoiceRecord, OrderRecord, TransactionRecord } from "./accounting.types"

/** What kind of record a lineage step is. */
export type LineageKind = "order" | "invoice" | "payment" | "adjustment"

/** One step of where a book entry came from. */
export interface LineageStep {
    /** The id of the record the step stands for, so a list can key its rows. */
    readonly id: string
    /** The kind of evidence. */
    readonly kind: LineageKind
    /** The label of the step. */
    readonly title: string
    /** More human evidence when present. */
    readonly detail: string | null
    /** The evidence time, ISO text. */
    readonly at: string | null
    /** The state of the record. */
    readonly status: string | null
    /** The amount, in VND. */
    readonly amount: number | null
}

/** The records an entry came from. */
export interface LineageSources {
    /** The order the money was for. */
    readonly order: OrderRecord | null
    /** The invoice behind the entry. */
    readonly invoice: InvoiceRecord | null
    /** The payment behind the entry. */
    readonly transaction: TransactionRecord | null
    /** The corrections that point at the invoice or the payment. */
    readonly adjustments: ReadonlyArray<AdjustmentRecord>
}

const RANK: Readonly<Record<LineageKind, number>> = { order: 0, invoice: 1, payment: 2, adjustment: 3 }

/** The source steps in the order the money moved: order, invoice, payment, then corrections by time. */
export const lineageOf = (sources: LineageSources): ReadonlyArray<LineageStep> => {
    const { order, invoice, transaction } = sources
    const steps: Array<LineageStep> = []
    if (order !== null)
        steps.push({
            id: order.id,
            kind: "order",
            title: order.orderNo,
            detail: null,
            at: null,
            status: order.status,
            amount: order.amountVnd,
        })
    if (invoice !== null)
        steps.push({
            id: invoice.id,
            kind: "invoice",
            title: invoice.invoiceNo,
            detail: invoice.customer,
            at: invoice.issuedAt ?? invoice.createdAt,
            status: invoice.status,
            amount: invoice.amountVnd,
        })
    if (transaction !== null)
        steps.push({
            id: transaction.id,
            kind: "payment",
            title: transaction.payer ?? transaction.reference ?? "-",
            detail: transaction.reference,
            at: transaction.occurredAt,
            status: transaction.status,
            amount: transaction.amountVnd,
        })
    for (const adjustment of sources.adjustments)
        steps.push({
            id: adjustment.id,
            kind: "adjustment",
            title: adjustment.createdBy,
            detail: adjustment.note,
            at: adjustment.createdAt,
            status: null,
            amount: adjustment.correctedAmountVnd,
        })
    return steps.sort((a, b) => RANK[a.kind] - RANK[b.kind] || String(a.at).localeCompare(String(b.at)))
}
