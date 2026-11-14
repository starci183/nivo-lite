import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { z } from "zod"
import type { BookEntryKind, BookEntryRecord } from "../rules/accounting.types"
import { canRepost } from "../rules/ledger-repost"
import { lineageOf, type LineageSources, type LineageStep } from "../rules/lineage"
import {
    adjustmentById,
    adjustmentsOf,
    bookEntryById,
    invoiceById,
    orderById,
    transactionById,
} from "../accounting-data"
import { ADJUSTMENTS, BOOK, INVOICES, LEADS, ORDERS, TRANSACTIONS } from "../ports"
import {
    SALES_LEDGER_ADJUSTMENT_ENTITY,
    SALES_INVOICE_ENTITY,
    SALES_TRANSACTION_ENTITY,
} from "../../../../shared/entities/sales-entity-names"

const variables: z.ZodObject<{ id: z.ZodUUID }> = z.object({ id: z.uuid() })

const ports = {
    book: BOOK,
    transactions: TRANSACTIONS,
    orders: ORDERS,
    invoices: INVOICES,
    leads: LEADS,
    adjustments: ADJUSTMENTS,
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
    /** Whether the payment behind the entry paid a paid order, so its ledger line may be asked for again. */
    readonly canRepostLedger: boolean
}

/** The ports the records behind an entry are read through. */
interface Sources {
    readonly leads: EntityApi
    readonly transactions: EntityApi
    readonly orders: EntityApi
    readonly invoices: EntityApi
    readonly adjustments: EntityApi
}

const NOTHING: LineageSources = { order: null, invoice: null, transaction: null, adjustments: [] }

/** The records an entry came from: a payment with its order, an invoice, or a correction; each with the corrections that point at it. */
const sourcesOf = async (entry: BookEntryRecord, stores: Sources): Promise<LineageSources> => {
    if (entry.sourceEntity === SALES_TRANSACTION_ENTITY) {
        const transaction = await transactionById(stores.transactions, entry.sourceId)
        const orderId = transaction?.orderId ?? null
        const order = orderId === null ? null : await orderById(stores.orders, orderId)
        const adjustments = await adjustmentsOf(stores.adjustments, "transaction", entry.sourceId)
        return { ...NOTHING, order, transaction, adjustments }
    }
    if (entry.sourceEntity === SALES_INVOICE_ENTITY) {
        const invoice = await invoiceById(stores.invoices, stores.leads, entry.sourceId)
        return { ...NOTHING, invoice, adjustments: await adjustmentsOf(stores.adjustments, "invoice", entry.sourceId) }
    }
    const adjustment =
        entry.sourceEntity === SALES_LEDGER_ADJUSTMENT_ENTITY ? await adjustmentById(stores.adjustments, entry.sourceId) : null
    return { ...NOTHING, adjustments: adjustment === null ? [] : [adjustment] }
}

/** `blocks-core.sales.api.entry.get`: one entry of the books with its lineage; null when the entry is gone. */
export const entryRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.entry.get",
    dataKind: "book-entry",
    shape: "record",
    fields: [
        "id",
        "kind",
        "entryDate",
        "amountVnd",
        "note",
        "sourceEntity",
        "sourceId",
        "lineage",
        "adjustmentCount",
        "canRepostLedger",
    ],
    paths: { lineage: "list" },
    variables,
    permission: "sales.view",
    ports,
    run: async ({ book, ...stores }, given): Promise<EntryDetail | null> => {
        const entry = await bookEntryById(book, given.id)
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
            canRepostLedger: entry.sourceEntity === SALES_TRANSACTION_ENTITY && canRepost(sources.transaction, sources.order),
        }
    },
})
