import { defineJob, type JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { z } from "zod"
import type { BookEntryValues } from "../../../../rules/sales/ledger/accounting.types"
import { postAdjustment, postInvoice, postTransaction } from "../../../../rules/sales/ledger/posting"
import type { AccountingSettings } from "../../../../rules/sales/ledger/settings"
import { adjustmentById, invoiceById, settlesInvoice, transactionById, workspaceSettings } from "../accounting-data"
import { ADJUSTMENTS, BOOK, INVOICES, LEADS, SETTINGS, TRANSACTIONS } from "../ports"
import {
    SALES_LEDGER_ADJUSTMENT_ENTITY,
    SALES_INVOICE_ENTITY,
    SALES_TRANSACTION_ENTITY,
} from "../../../../entities/sales/sales-entity-names"

/** The name of the job: the outbox enqueues it by this name. */
const JOB_NAME = "sales.book-project"

/** How many times the queue delivers the job before it is parked. */
const ATTEMPTS = 5

/** The unique constraint of a book entry: one entry per source row and kind. */
const SOURCE_KEY = "source_key"

const input: z.ZodObject<{
    sourceEntity: z.ZodEnum<{
        [SALES_TRANSACTION_ENTITY]: typeof SALES_TRANSACTION_ENTITY
        [SALES_INVOICE_ENTITY]: typeof SALES_INVOICE_ENTITY
        [SALES_LEDGER_ADJUSTMENT_ENTITY]: typeof SALES_LEDGER_ADJUSTMENT_ENTITY
    }>
    sourceId: z.ZodUUID
}> = z.object({
    sourceEntity: z.enum([SALES_TRANSACTION_ENTITY, SALES_INVOICE_ENTITY, SALES_LEDGER_ADJUSTMENT_ENTITY]),
    sourceId: z.uuid(),
})

/** The port definitions of the job, by the name `run` reaches them by. */
type BookProjectPorts = {
    /** The payments. */
    readonly transactions: PortDefinition<EntityApi>
    /** The invoices. */
    readonly invoices: PortDefinition<EntityApi>
    /** The sale's records of the customers, whose names the invoice lines carry. */
    readonly leads: PortDefinition<EntityApi>
    /** The corrections. */
    readonly adjustments: PortDefinition<EntityApi>
    /** The books. */
    readonly book: PortDefinition<EntityApi>
    /** The rules the workspace chose for its books. */
    readonly settings: PortDefinition<EntityApi>
}

const ports: BookProjectPorts = {
    transactions: TRANSACTIONS,
    invoices: INVOICES,
    leads: LEADS,
    adjustments: ADJUSTMENTS,
    book: BOOK,
    settings: SETTINGS,
}

/** The ports a source row is read through. */
interface Sources {
    readonly transactions: EntityApi
    readonly invoices: EntityApi
    readonly leads: EntityApi
    readonly adjustments: EntityApi
}

/** The entries one source row posts, as the posting rules say; none when the row is gone. */
const entriesOf = async (
    entity: z.output<typeof input>["sourceEntity"],
    id: string,
    sources: Sources,
    settings: AccountingSettings,
): Promise<ReadonlyArray<BookEntryValues>> => {
    if (entity === SALES_TRANSACTION_ENTITY) {
        const transaction = await transactionById(sources.transactions, id)
        return transaction === null ? [] : postTransaction(transaction, settings)
    }
    if (entity === SALES_INVOICE_ENTITY) {
        const invoice = await invoiceById(sources.invoices, sources.leads, id)
        return invoice === null ? [] : postInvoice(invoice, await settlesInvoice(sources.transactions, id), settings)
    }
    const adjustment = await adjustmentById(sources.adjustments, id)
    return adjustment === null ? [] : [postAdjustment(adjustment)]
}

/**
 * `sales.book-project`: keeps the books (the `blocks-core.sales.ledger-entry` projection) in step with one source row. Enqueued by the
 * write that changed the row, it reads the row as it is now and writes what the posting rules say, one entry per source row and kind
 * (a repeat rewrites the same entry, so a re-run changes nothing). A source that is gone posts nothing. A backfill enqueues it for
 * every source row.
 */
export const bookProjectJob: JobDefinition<typeof input, BookProjectPorts> = defineJob({
    name: JOB_NAME,
    input,
    ports,
    attempts: ATTEMPTS,
    run: async ({ transactions, invoices, leads, adjustments, book, settings }, given) => {
        const entries = await entriesOf(
            given.sourceEntity,
            given.sourceId,
            { transactions, invoices, leads, adjustments },
            await workspaceSettings(settings),
        )
        await Promise.all(entries.map((entry) => book.upsert(SOURCE_KEY, { ...entry })))
    },
})
