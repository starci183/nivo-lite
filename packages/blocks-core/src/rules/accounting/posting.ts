import type {
    AdjustmentRecord,
    BookEntryValues,
    InvoiceRecord,
    OrderRecord,
    TransactionRecord,
} from "./accounting.types"
import { shopDayOf } from "./shop-time"
import type { LedgerEntry } from "../../vocabulary"

/** The entity names the book entries point back to. */
export const SOURCE_TRANSACTION = "payment.transaction"
/** The entity name of an invoice source. */
export const SOURCE_INVOICE = "accounting.invoice"
/** The entity name of a correction source. */
export const SOURCE_ADJUSTMENT = "accounting.adjustment"

/** The words joined into a note, empty parts left out; the entity of the source row when nothing is left, so a list always has a title to draw. */
const noteOf = (source: string, ...parts: ReadonlyArray<string | null>): string => {
    const joined = parts.filter((part): part is string => part !== null && part !== "").join(" / ")
    return joined === "" ? source : joined
}

/**
 * The book entries a payment transaction posts. Only money in that a person or a rule tied to what it paid is income; a transfer
 * nobody matched yet, or one that waits for review, is not in the books until it is, and money out is no entry of this book.
 */
export const postTransaction = (transaction: TransactionRecord): ReadonlyArray<BookEntryValues> =>
    transaction.direction === "credit" && transaction.status === "matched"
        ? [
              {
                  kind: "income",
                  sourceEntity: SOURCE_TRANSACTION,
                  sourceId: transaction.id,
                  entryDate: shopDayOf(transaction.occurredAt),
                  amountVnd: transaction.amountVnd,
                  note: noteOf(SOURCE_TRANSACTION, transaction.payer, transaction.reference),
              },
          ]
        : []

/**
 * The book entries an invoice posts. A draft or a void invoice posts nothing. An issued or paid invoice posts what is owed
 * (`invoice`). A paid invoice that no bank credit settled (a customer's claim a person confirmed) also posts the income itself, so
 * money is never counted twice: an invoice with a matched credit leaves the income to the credit.
 */
export const postInvoice = (invoice: InvoiceRecord, settledByTransaction: boolean): ReadonlyArray<BookEntryValues> => {
    if (invoice.status === "draft" || invoice.status === "void") return []
    const owed: BookEntryValues = {
        kind: "invoice",
        sourceEntity: SOURCE_INVOICE,
        sourceId: invoice.id,
        entryDate: shopDayOf(invoice.issuedAt ?? invoice.createdAt),
        amountVnd: invoice.amountVnd,
        note: noteOf(SOURCE_INVOICE, invoice.invoiceNo, invoice.customer),
    }
    if (invoice.status !== "paid" || settledByTransaction) return [owed]
    return [
        owed,
        { ...owed, kind: "income", entryDate: shopDayOf(invoice.paidAt ?? invoice.issuedAt ?? invoice.createdAt) },
    ]
}

/** The book entry a correction posts: its corrected amount (nothing when it is only a note) and its note. */
export const postAdjustment = (adjustment: AdjustmentRecord): BookEntryValues => ({
    kind: "adjustment",
    sourceEntity: SOURCE_ADJUSTMENT,
    sourceId: adjustment.id,
    entryDate: shopDayOf(adjustment.createdAt),
    amountVnd: adjustment.correctedAmountVnd ?? 0,
    note: noteOf(SOURCE_ADJUSTMENT, adjustment.createdBy, adjustment.note),
})

/** The line of the business ledger (the sheet behind the door) of a transaction that paid an order. */
export const ledgerLineOf = (
    transaction: TransactionRecord,
    order: OrderRecord,
    leadName: string | null,
): LedgerEntry => ({
    date: shopDayOf(transaction.occurredAt),
    orderNo: order.orderNo,
    customer: leadName ?? transaction.payer ?? "",
    amountVnd: transaction.amountVnd,
    transactionId: transaction.id,
    status: "paid",
    note: "",
})
