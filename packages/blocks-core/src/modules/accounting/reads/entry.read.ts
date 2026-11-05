import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import type { BookEntryKind, BookEntryRecord } from "../../../rules/accounting/accounting.types"
import { lineageOf } from "../../../rules/accounting/lineage"
import type { LineageSources, LineageStep } from "../../../rules/accounting/lineage"
import { SOURCE_ADJUSTMENT, SOURCE_INVOICE, SOURCE_TRANSACTION } from "../../../rules/accounting/posting"
import type { AdjustmentStore, InvoiceStore, OrderStore, TransactionStore } from "../accounting.types"
import { adjustmentsPort, bookEntriesPort, invoicesPort, ordersPort, transactionsPort } from "../ports"

const MAX_ID = 200

const variables: z.ZodObject<{ id: z.ZodString }> = z.object({ id: z.string().min(1).max(MAX_ID) })

const ports = {
    book: bookEntriesPort,
    transactions: transactionsPort,
    orders: ordersPort,
    invoices: invoicesPort,
    adjustments: adjustmentsPort,
}

/** One entry of the books with where it came from. */
export interface EntryDetail {
    /** The entry id. */
    readonly id: string
    /** What the entry records. */
    readonly kind: BookEntryKind
    /** The shop day of the entry, `YYYY-MM-DD`. */
    readonly entryDate: string
    /** The amount, in VND. */
    readonly amountVnd: number
    /** A short note, or null. */
    readonly note: string | null
    /** The entity of the row the entry comes from. */
    readonly sourceEntity: string
    /** The row the entry comes from. */
    readonly sourceId: string
    /** The source steps in the order the money moved. */
    readonly lineage: ReadonlyArray<LineageStep>
    /** How many corrections point at the source. */
    readonly adjustmentCount: number
}

/** The stores the records behind an entry are read from. */
interface Sources {
    readonly transactions: TransactionStore
    readonly orders: OrderStore
    readonly invoices: InvoiceStore
    readonly adjustments: AdjustmentStore
}

const NOTHING: LineageSources = { order: null, invoice: null, transaction: null, adjustments: [] }

/** The records an entry came from: a payment with its order, an invoice, or a correction; each with the corrections that point at it. */
const sourcesOf = async (entry: BookEntryRecord, stores: Sources): Promise<LineageSources> => {
    if (entry.sourceEntity === SOURCE_TRANSACTION) {
        const transaction = await stores.transactions.get(entry.sourceId)
        const orderId = transaction?.orderId ?? null
        const order = orderId === null ? null : await stores.orders.get(orderId)
        const adjustments = await stores.adjustments.of("transaction", entry.sourceId)
        return { ...NOTHING, order, transaction, adjustments }
    }
    if (entry.sourceEntity === SOURCE_INVOICE) {
        const invoice = await stores.invoices.get(entry.sourceId)
        return { ...NOTHING, invoice, adjustments: await stores.adjustments.of("invoice", entry.sourceId) }
    }
    const adjustment = entry.sourceEntity === SOURCE_ADJUSTMENT ? await stores.adjustments.get(entry.sourceId) : null
    return { ...NOTHING, adjustments: adjustment === null ? [] : [adjustment] }
}

/** `accounting.entry`: one entry of the books with its lineage; null when the entry is gone. */
export const entryRead: ReadDefinition = defineRead({
    id: "accounting.entry",
    dataKind: "book-entry",
    shape: "record",
    fields: ["id", "kind", "entryDate", "amountVnd", "note", "sourceEntity", "sourceId", "lineage", "adjustmentCount"],
    paths: { lineage: "list" },
    variables,
    permission: "accounting.view",
    ports,
    run: async ({ book, ...stores }, given): Promise<EntryDetail | null> => {
        const entry = await book.get(given.id)
        if (entry === null) return null
        const sources = await sourcesOf(entry, stores)
        return {
            id: entry.id,
            kind: entry.kind,
            entryDate: entry.entryDate,
            amountVnd: entry.amountVnd,
            note: entry.note,
            sourceEntity: entry.sourceEntity,
            sourceId: entry.sourceId,
            lineage: lineageOf(sources),
            adjustmentCount: sources.adjustments.length,
        }
    },
})
