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
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import type { AdjustmentStore, BookEntryStore, InvoiceStore, TransactionStore } from "../accounting.types"
import { adjustmentsPort, bookEntriesPort, invoicesPort, transactionsPort } from "../ports"
import { DONE, defineJob } from "./job"
import type { JobDefinition } from "./job"

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

type BookProjectPorts = {
    readonly transactions: PortDefinition<TransactionStore>
    readonly invoices: PortDefinition<InvoiceStore>
    readonly adjustments: PortDefinition<AdjustmentStore>
    readonly book: PortDefinition<BookEntryStore>
}

const ports: BookProjectPorts = {
    transactions: transactionsPort,
    invoices: invoicesPort,
    adjustments: adjustmentsPort,
    book: bookEntriesPort,
}

/** The stores a source row is read from. */
interface Sources {
    readonly transactions: TransactionStore
    readonly invoices: InvoiceStore
    readonly adjustments: AdjustmentStore
}

/** The entries one source row posts, as the posting rules say; none when the row is gone. */
const entriesOf = async (
    entity: z.output<typeof input>["sourceEntity"],
    id: string,
    sources: Sources,
): Promise<ReadonlyArray<BookEntryValues>> => {
    if (entity === SOURCE_TRANSACTION) {
        const transaction = await sources.transactions.get(id)
        return transaction === null ? [] : postTransaction(transaction)
    }
    if (entity === SOURCE_INVOICE) {
        const invoice = await sources.invoices.get(id)
        return invoice === null ? [] : postInvoice(invoice, await sources.transactions.settlesInvoice(id))
    }
    const adjustment = await sources.adjustments.get(id)
    return adjustment === null ? [] : [postAdjustment(adjustment)]
}

/**
 * `accounting.book-project`: keeps the books (the `accounting.book-entry` projection) in step with one source row. Enqueued by the
 * write that changed the row, it reads the row as it is now and writes what the posting rules say, one entry per source row and kind
 * (a repeat rewrites the same entry, so a re-run changes nothing). A source that is gone posts nothing. A backfill enqueues it for
 * every source row.
 */
export const bookProjectJob: JobDefinition<typeof input, BookProjectPorts> = defineJob({
    name: "accounting.book-project",
    input,
    ports,
    attempts: 5,
    run: async ({ transactions, invoices, adjustments, book }, given) => {
        const entries = await entriesOf(given.sourceEntity, given.sourceId, { transactions, invoices, adjustments })
        await Promise.all(entries.map((entry) => book.upsert(entry)))
        return DONE
    },
})
