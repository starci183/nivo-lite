import { defineJob } from "@nivo-lite/agent-sdk/mutation"
import type { JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { z } from "zod"
import type { BookEntryValues } from "../../../rules/accounting/accounting.types"
import {
    SOURCE_ADJUSTMENT,
    SOURCE_INVOICE,
    SOURCE_TRANSACTION,
    postAdjustment,
    postInvoice,
    postTransaction,
} from "../../../rules/accounting/posting"
import { adjustmentById, invoiceById, settlesInvoice, transactionById } from "../accounting-data"
import { ADJUSTMENTS, BOOK, INVOICES, TRANSACTIONS } from "../ports"

/** The name of the job: the outbox enqueues it by this name. */
const JOB_NAME = "accounting.book-project"

/** How many times the queue delivers the job before it is parked. */
const ATTEMPTS = 5

/** The unique constraint of a book entry: one entry per source row and kind. */
const SOURCE_KEY = "source_key"

const input: z.ZodObject<{
    sourceEntity: z.ZodEnum<{
        "payment.transaction": "payment.transaction"
        "accounting.invoice": "accounting.invoice"
        "accounting.adjustment": "accounting.adjustment"
    }>
    sourceId: z.ZodUUID
}> = z.object({
    sourceEntity: z.enum([SOURCE_TRANSACTION, SOURCE_INVOICE, SOURCE_ADJUSTMENT]),
    sourceId: z.uuid(),
})

/** The port definitions of the job, by the name `run` reaches them by. */
type BookProjectPorts = {
    /** The payments. */
    readonly transactions: PortDefinition<EntityApi>
    /** The invoices. */
    readonly invoices: PortDefinition<EntityApi>
    /** The corrections. */
    readonly adjustments: PortDefinition<EntityApi>
    /** The books. */
    readonly book: PortDefinition<EntityApi>
}

const ports: BookProjectPorts = {
    transactions: TRANSACTIONS,
    invoices: INVOICES,
    adjustments: ADJUSTMENTS,
    book: BOOK,
}

/** The ports a source row is read through. */
interface Sources {
    readonly transactions: EntityApi
    readonly invoices: EntityApi
    readonly adjustments: EntityApi
}

/** The entries one source row posts, as the posting rules say; none when the row is gone. */
const entriesOf = async (
    entity: z.output<typeof input>["sourceEntity"],
    id: string,
    sources: Sources,
): Promise<ReadonlyArray<BookEntryValues>> => {
    if (entity === SOURCE_TRANSACTION) {
        const transaction = await transactionById(sources.transactions, id)
        return transaction === null ? [] : postTransaction(transaction)
    }
    if (entity === SOURCE_INVOICE) {
        const invoice = await invoiceById(sources.invoices, id)
        return invoice === null ? [] : postInvoice(invoice, await settlesInvoice(sources.transactions, id))
    }
    const adjustment = await adjustmentById(sources.adjustments, id)
    return adjustment === null ? [] : [postAdjustment(adjustment)]
}

/**
 * `accounting.book-project`: keeps the books (the `accounting.book-entry` projection) in step with one source row. Enqueued by the
 * write that changed the row, it reads the row as it is now and writes what the posting rules say, one entry per source row and kind
 * (a repeat rewrites the same entry, so a re-run changes nothing). A source that is gone posts nothing. A backfill enqueues it for
 * every source row.
 */
export const bookProjectJob: JobDefinition<typeof input, BookProjectPorts> = defineJob({
    name: JOB_NAME,
    input,
    ports,
    attempts: ATTEMPTS,
    run: async ({ transactions, invoices, adjustments, book }, given) => {
        const entries = await entriesOf(given.sourceEntity, given.sourceId, { transactions, invoices, adjustments })
        await Promise.all(entries.map((entry) => book.upsert(SOURCE_KEY, { ...entry })))
    },
})
