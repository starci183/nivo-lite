import type {
    AdjustmentRecord,
    BookEntryValues,
    InvoiceRecord,
    OrderRecord,
    TransactionRecord,
} from "./accounting.types"
import type { AccountingSettings } from "./settings"
import { entryStatusOf } from "./entry-status"
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

/** The record an entry comes from. */
interface EntrySource {
    /** The entity of the record. */
    readonly entity: string
    /** Its id. */
    readonly id: string
}

/** The entry of a kind with the status the reader sees: a source row, a day, an amount, what it says and who it is with. */
const entryOf = (
    kind: BookEntryValues["kind"],
    source: EntrySource,
    day: string,
    amountVnd: number,
    note: string,
    counterparty: string | null,
): BookEntryValues => ({
    kind,
    sourceEntity: source.entity,
    sourceId: source.id,
    entryDate: day,
    amountVnd,
    note,
    counterparty,
    status: entryStatusOf(kind),
})

/**
 * The book entries a payment transaction posts. Money in that a person or a rule tied to what it paid is income; money in nobody
 * matched yet, or that waits for review, is income only when the settings post unmatched money. Money out is an expense when the
 * settings post expenses, and nothing otherwise.
 */
export const postTransaction = (
    transaction: TransactionRecord,
    settings: AccountingSettings,
): ReadonlyArray<BookEntryValues> => {
    const posted =
        transaction.direction === "credit"
            ? transaction.status === "matched" || settings.postUnmatched
            : settings.postExpenses
    if (!posted) return []
    return [
        entryOf(
            transaction.direction === "credit" ? "income" : "expense",
            { entity: SOURCE_TRANSACTION, id: transaction.id },
            shopDayOf(transaction.occurredAt),
            transaction.amountVnd,
            noteOf(SOURCE_TRANSACTION, transaction.payer, transaction.reference),
            transaction.payer,
        ),
    ]
}

/**
 * The book entries an invoice posts. A draft invoice posts nothing. An issued or paid invoice posts what is owed (`invoice`) when
 * the settings post outgoing invoices. A paid invoice that no bank credit settled (a customer's claim a person confirmed) also posts
 * the income itself, so money is never counted twice: an invoice with a matched credit leaves the income to the credit. A void
 * invoice that was issued, and so posted, gets a reversal of what it owed when the settings say so; the entry it reverses stays.
 */
export const postInvoice = (
    invoice: InvoiceRecord,
    settledByTransaction: boolean,
    settings: AccountingSettings,
): ReadonlyArray<BookEntryValues> => {
    if (invoice.status === "draft") return []
    const source = { entity: SOURCE_INVOICE, id: invoice.id }
    const note = noteOf(SOURCE_INVOICE, invoice.invoiceNo, invoice.customer)
    const owed = entryOf(
        "invoice",
        source,
        shopDayOf(invoice.issuedAt ?? invoice.createdAt),
        invoice.amountVnd,
        note,
        invoice.customer,
    )
    if (invoice.status === "void") {
        const reversed = settings.voidMode === "reversal" && settings.postOutgoing && invoice.issuedAt !== null
        return reversed
            ? [{ ...owed, kind: "reversal", status: entryStatusOf("reversal"), amountVnd: -invoice.amountVnd }]
            : []
    }
    const entries: Array<BookEntryValues> = settings.postOutgoing ? [owed] : []
    if (invoice.status === "paid" && !settledByTransaction)
        entries.push({
            ...owed,
            kind: "income",
            status: entryStatusOf("income"),
            entryDate: shopDayOf(invoice.paidAt ?? invoice.issuedAt ?? invoice.createdAt),
        })
    return entries
}

/** The book entry a correction posts: its corrected amount (nothing when it is only a note) and its note. */
export const postAdjustment = (adjustment: AdjustmentRecord): BookEntryValues =>
    entryOf(
        "adjustment",
        { entity: SOURCE_ADJUSTMENT, id: adjustment.id },
        shopDayOf(adjustment.createdAt),
        adjustment.correctedAmountVnd ?? 0,
        noteOf(SOURCE_ADJUSTMENT, adjustment.createdBy, adjustment.note),
        null,
    )

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
