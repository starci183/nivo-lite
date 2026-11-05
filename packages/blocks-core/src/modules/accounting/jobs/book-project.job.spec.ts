import {
    ADJUSTMENT,
    INVOICE,
    ORDER,
    TRANSACTION,
    invoiceOf,
    transactionOf,
} from "../../../rules/accounting/accounting.fixtures"
import type { BookEntryValues } from "../../../rules/accounting/accounting.types"
import { adjustmentStore, bookEntryStore, invoiceStore, transactionStore } from "../accounting.doubles"
import { bookProjectJob } from "./book-project.job"
import type { JobContext } from "./job"

const CONTEXT: JobContext = { workspaceId: "w1", attempt: 1, effectKey: (step) => step }
const matched = transactionOf({ status: "matched", orderId: ORDER.id })

const harness = () => {
    const written: Array<BookEntryValues> = []
    const ports = {
        transactions: transactionStore({
            get: (id) => Promise.resolve(id === matched.id ? matched : null),
            settlesInvoice: (id) => Promise.resolve(id === "settled-invoice"),
        }),
        invoices: invoiceStore({
            get: (id) =>
                Promise.resolve(
                    id === "settled-invoice" ? invoiceOf({ id, status: "paid" }) : id === INVOICE.id ? INVOICE : null,
                ),
        }),
        adjustments: adjustmentStore({ get: (id) => Promise.resolve(id === ADJUSTMENT.id ? ADJUSTMENT : null) }),
        book: bookEntryStore({
            upsert: (values) => {
                written.push(values)
                return Promise.resolve({ ok: true, row: { ...values, id: "e1", version: "1" } })
            },
        }),
    }
    const run = (
        sourceEntity: "payment.transaction" | "accounting.invoice" | "accounting.adjustment",
        sourceId: string,
    ) => bookProjectJob.run(ports, { sourceEntity, sourceId }, CONTEXT)
    return { written, run }
}

describe("accounting.book-project", () => {
    it("declares itself with the source's entity and id only in its payload", () => {
        expect(bookProjectJob.name).toBe("accounting.book-project")
        expect(Object.keys(bookProjectJob.input.shape)).toEqual(["sourceEntity", "sourceId"])
    })

    it("posts a matched payment as income", async () => {
        const { written, run } = harness()
        await run("payment.transaction", TRANSACTION.id)
        expect(written.map((entry) => [entry.kind, entry.sourceId, entry.amountVnd])).toEqual([
            ["income", TRANSACTION.id, 5_000_000],
        ])
    })

    it("posts an open invoice as what is owed, and a paid invoice a credit settled the same", async () => {
        const open = harness()
        await open.run("accounting.invoice", INVOICE.id)
        expect(open.written.map((entry) => entry.kind)).toEqual(["invoice"])
        const paid = harness()
        await paid.run("accounting.invoice", "settled-invoice")
        expect(paid.written.map((entry) => entry.kind)).toEqual(["invoice"])
    })

    it("posts a correction", async () => {
        const { written, run } = harness()
        await run("accounting.adjustment", ADJUSTMENT.id)
        expect(written.map((entry) => [entry.kind, entry.amountVnd])).toEqual([["adjustment", 1_800_000]])
    })

    it("posts nothing for a source that is gone", async () => {
        const { written, run } = harness()
        await run("payment.transaction", "7f0f0f0f-0000-4000-8000-000000000001")
        await run("accounting.invoice", "7f0f0f0f-0000-4000-8000-000000000002")
        await run("accounting.adjustment", "7f0f0f0f-0000-4000-8000-000000000003")
        expect(written).toEqual([])
    })
})
