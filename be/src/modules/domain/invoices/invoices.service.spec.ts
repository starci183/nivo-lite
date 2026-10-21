import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { InvoicesErrorCode } from "./errors/invoices.error"
import type { NewInvoice } from "./invoices.contracts"
import { InvoicesService } from "./invoices.service"
import type {
    InvoiceAccountingRow,
    InvoiceListingRow,
    InvoiceRow,
    ReconcileInvoiceRow,
} from "./persistence/invoices.rows"
import type { InvoiceViewRow } from "./persistence/invoice-views.rows"
import { LIST_LEAD_INVOICES, LIST_WORKBENCH_INVOICES } from "./persistence/invoice-views.sql"
import {
    FIND_INVOICE,
    FIND_INVOICE_OF_ORDER,
    FIND_LATEST_LEAD_INVOICE,
    INSERT_INVOICE,
    LAST_INVOICE_NUMBER,
    LIST_ACCOUNTING_INVOICES,
    LIST_ISSUED_INVOICES,
    LIST_RECONCILE_INVOICES,
    MARK_INVOICE_PAID,
} from "./persistence/invoices.sql"

const WS = "11111111-1111-4111-8111-111111111111"
const INVOICE: InvoiceRow = {
    id: "inv-1",
    workspace_id: WS,
    order_id: "o1",
    lead_id: "l1",
    invoice_no: "HD-01",
    amount_vnd: 50_000,
    status: "issued",
    issued_by: null,
    paid_at: null,
}
const NOW = "2026-10-13T10:00:00.000Z"
const DUE_AT = "2026-10-28T10:00:00.000Z"
const INPUT: NewInvoice = {
    workspaceId: WS,
    orderId: "o1",
    leadId: "l1",
    amountVnd: 50_000,
    issuedBy: "Lan",
}
const VIEW: InvoiceViewRow = { ...INVOICE, due_at: DUE_AT, issued_at: NOW, created_at: NOW }

const build = async (em: MockEntityManager): Promise<InvoicesService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            InvoicesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock("2026-10-13T10:00:00.000Z") },
        ],
    }).compile()
    return moduleRef.get(InvoicesService)
}

describe("InvoicesService", () => {
    it("finds the customer's newest open invoice", async () => {
        const service = await build(mockEntityManager({ query: [FIND_LATEST_LEAD_INVOICE, [INVOICE]] }))
        await expect(service.latestOfLead(WS, "l1", "issued")).resolves.toEqual(INVOICE)
    })

    it("answers null when the customer has no invoice in that state", async () => {
        const service = await build(mockEntityManager({ query: [FIND_LATEST_LEAD_INVOICE, []] }))
        await expect(service.latestOfLead(WS, "l1", "paid")).resolves.toBeNull()
    })

    it("finds one invoice of the workspace", async () => {
        const service = await build(mockEntityManager({ query: [FIND_INVOICE, [INVOICE]] }))
        await expect(service.find(WS, "inv-1")).resolves.toEqual(INVOICE)
    })

    it("answers null for an invoice the workspace does not have", async () => {
        const em = mockEntityManager({ query: [FIND_INVOICE, []] })
        const service = await build(em)

        await expect(service.find(WS, "missing")).resolves.toBeNull()
        expect(em.query).toHaveBeenCalledWith(FIND_INVOICE, [WS, "missing"])
    })

    it("reads the invoice of an order, or null when it has none", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_INVOICE_OF_ORDER, [INVOICE]],
                [FIND_INVOICE_OF_ORDER, []],
            ],
        })
        const service = await build(em)

        await expect(service.ofOrder(WS, "o1")).resolves.toEqual(INVOICE)
        await expect(service.ofOrder(WS, "o2")).resolves.toBeNull()
        expect(em.query.mock.calls).toEqual([
            [FIND_INVOICE_OF_ORDER, [WS, "o1"]],
            [FIND_INVOICE_OF_ORDER, [WS, "o2"]],
        ])
    })

    it("lists the newest issued invoices up to the requested limit", async () => {
        const row: InvoiceListingRow = { ...INVOICE, order_no: "ORDER-1", contact_name: "Minh" }
        const em = mockEntityManager({
            query: [
                [LIST_ISSUED_INVOICES, [row]],
                [LIST_ISSUED_INVOICES, []],
            ],
        })
        const service = await build(em)

        await expect(service.listIssued(WS, 20)).resolves.toEqual([row])
        await expect(service.listIssued(WS, 10)).resolves.toEqual([])
        expect(em.query.mock.calls).toEqual([
            [LIST_ISSUED_INVOICES, [WS, 20]],
            [LIST_ISSUED_INVOICES, [WS, 10]],
        ])
    })
})

describe("InvoicesService", () => {
    it("lists accounting invoices with the default or requested limit", async () => {
        const row: InvoiceAccountingRow = { ...VIEW, order: null, lead: null }
        const em = mockEntityManager({
            query: [
                [LIST_ACCOUNTING_INVOICES, [row]],
                [LIST_ACCOUNTING_INVOICES, []],
            ],
        })
        const service = await build(em)

        await expect(service.listAccounting(WS)).resolves.toEqual([row])
        await expect(service.listAccounting(WS, 25)).resolves.toEqual([])
        expect(em.query.mock.calls).toEqual([
            [LIST_ACCOUNTING_INVOICES, [WS, 1000]],
            [LIST_ACCOUNTING_INVOICES, [WS, 25]],
        ])
    })

    it("does not read reconciliation invoices for an empty selection", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.listForReconcile(WS, [])).resolves.toEqual([])
        expect(em.query).not.toHaveBeenCalled()
    })

    it("reads at most fifty reconciliation invoices without changing the selection", async () => {
        const row: ReconcileInvoiceRow = {
            id: INVOICE.id,
            invoice_no: INVOICE.invoice_no,
            amount_vnd: INVOICE.amount_vnd,
            status: INVOICE.status,
            customer: "Minh",
            company: null,
            order_no: "ORDER-1",
            order_items: "Tea",
            order_status: "invoiced",
            issued_at: NOW,
            due_at: DUE_AT,
        }
        const ids = Array.from({ length: 52 }, (_, index) => `inv-${index + 1}`)
        const em = mockEntityManager({ query: [LIST_RECONCILE_INVOICES, [row]] })
        const service = await build(em)

        await expect(service.listForReconcile(WS, ids)).resolves.toEqual([row])
        expect(em.query).toHaveBeenCalledWith(LIST_RECONCILE_INVOICES, [WS, ids.slice(0, 50)])
        expect(ids).toHaveLength(52)
        expect(ids[51]).toBe("inv-52")
    })

    it("reads the workbench invoices with a limit of five hundred", async () => {
        const em = mockEntityManager({ query: [LIST_WORKBENCH_INVOICES, [VIEW]] })
        const service = await build(em)

        await expect(service.listForWorkbench(WS)).resolves.toEqual([VIEW])
        expect(em.query).toHaveBeenCalledWith(LIST_WORKBENCH_INVOICES, [WS, 500])
    })

    it("reads the invoices of one customer", async () => {
        const em = mockEntityManager({ query: [LIST_LEAD_INVOICES, [VIEW]] })
        const service = await build(em)

        await expect(service.listForLead(WS, "l1")).resolves.toEqual([VIEW])
        expect(em.query).toHaveBeenCalledWith(LIST_LEAD_INVOICES, [WS, "l1"])
    })
})

describe("InvoicesService", () => {
    it("issues the next monthly number with the clock's dates and issuer", async () => {
        const created = { ...INVOICE, invoice_no: "INV-202610-0043", issued_by: "Lan" }
        const em = mockEntityManager({
            query: [
                [LAST_INVOICE_NUMBER, [{ invoice_no: "INV-202610-0042" }]],
                [INSERT_INVOICE, [created]],
            ],
        })
        const service = await build(em)

        await expect(service.issue(INPUT)).resolves.toEqual({ invoice: created, created: true })
        expect(em.query.mock.calls).toEqual([
            [LAST_INVOICE_NUMBER, [WS, "INV-202610-"]],
            [INSERT_INVOICE, [WS, "o1", "l1", "INV-202610-0043", 50_000, DUE_AT, "Lan", NOW]],
        ])
    })

    it.each([{ last: [] }, { last: [{ invoice_no: null }] }])(
        "starts a month at one when no last number is present: %p",
        async ({ last }) => {
            const created = { ...INVOICE, invoice_no: "INV-202610-0001", order_id: null, lead_id: null }
            const em = mockEntityManager({
                query: [
                    [LAST_INVOICE_NUMBER, last],
                    [INSERT_INVOICE, [created]],
                ],
            })
            const service = await build(em)

            await expect(service.issue({ ...INPUT, orderId: null, leadId: null })).resolves.toEqual({
                invoice: created,
                created: true,
            })
            expect(em.query.mock.calls).toEqual([
                [LAST_INVOICE_NUMBER, [WS, "INV-202610-"]],
                [INSERT_INVOICE, [WS, null, null, "INV-202610-0001", 50_000, DUE_AT, "Lan", NOW]],
            ])
        },
    )

    it("returns the order's existing invoice after an insert conflict", async () => {
        const em = mockEntityManager({
            query: [
                [LAST_INVOICE_NUMBER, []],
                [INSERT_INVOICE, []],
                [FIND_INVOICE_OF_ORDER, [INVOICE]],
            ],
        })
        const service = await build(em)

        await expect(service.issue(INPUT)).resolves.toEqual({ invoice: INVOICE, created: false })
        expect(em.query.mock.calls).toEqual([
            [LAST_INVOICE_NUMBER, [WS, "INV-202610-"]],
            [INSERT_INVOICE, [WS, "o1", "l1", "INV-202610-0001", 50_000, DUE_AT, "Lan", NOW]],
            [FIND_INVOICE_OF_ORDER, [WS, "o1"]],
        ])
    })
})

describe("InvoicesService", () => {
    it("tries the following number when the conflicted order has no existing invoice", async () => {
        const created = { ...INVOICE, invoice_no: "INV-202610-0002" }
        const em = mockEntityManager({
            query: [
                [LAST_INVOICE_NUMBER, []],
                [INSERT_INVOICE, []],
                [FIND_INVOICE_OF_ORDER, []],
                [INSERT_INVOICE, [created]],
            ],
        })
        const service = await build(em)

        await expect(service.issue(INPUT)).resolves.toEqual({ invoice: created, created: true })
        expect(em.query.mock.calls).toEqual([
            [LAST_INVOICE_NUMBER, [WS, "INV-202610-"]],
            [INSERT_INVOICE, [WS, "o1", "l1", "INV-202610-0001", 50_000, DUE_AT, "Lan", NOW]],
            [FIND_INVOICE_OF_ORDER, [WS, "o1"]],
            [INSERT_INVOICE, [WS, "o1", "l1", "INV-202610-0002", 50_000, DUE_AT, "Lan", NOW]],
        ])
    })

    it("gives up after four taken numbers for an invoice without an order", async () => {
        const em = mockEntityManager({
            query: [
                [LAST_INVOICE_NUMBER, [{ invoice_no: "INV-202610-0008" }]],
                [INSERT_INVOICE, []],
            ],
        })
        const service = await build(em)

        await expect(service.issue({ ...INPUT, orderId: null })).rejects.toMatchObject({
            code: InvoicesErrorCode.NotNumbered,
        })
        expect(em.query.mock.calls).toEqual([
            [LAST_INVOICE_NUMBER, [WS, "INV-202610-"]],
            [INSERT_INVOICE, [WS, null, "l1", "INV-202610-0009", 50_000, DUE_AT, "Lan", NOW]],
            [INSERT_INVOICE, [WS, null, "l1", "INV-202610-0010", 50_000, DUE_AT, "Lan", NOW]],
            [INSERT_INVOICE, [WS, null, "l1", "INV-202610-0011", 50_000, DUE_AT, "Lan", NOW]],
            [INSERT_INVOICE, [WS, null, "l1", "INV-202610-0012", 50_000, DUE_AT, "Lan", NOW]],
        ])
    })

    it("marks an invoice paid at the clock instant", async () => {
        const paid = { ...INVOICE, status: "paid", paid_at: NOW }
        const em = mockEntityManager({ query: [MARK_INVOICE_PAID, [paid]] })
        const service = await build(em)

        await expect(service.markPaid(WS, "inv-1")).resolves.toEqual(paid)
        expect(em.query.mock.calls).toEqual([[MARK_INVOICE_PAID, [WS, "inv-1", NOW]]])
    })

    it("rejects payment when the invoice is absent from the workspace", async () => {
        const em = mockEntityManager({ query: [MARK_INVOICE_PAID, []] })
        const service = await build(em)

        await expect(service.markPaid(WS, "missing")).rejects.toMatchObject({
            code: InvoicesErrorCode.NotFound,
        })
        expect(em.query).toHaveBeenCalledWith(MARK_INVOICE_PAID, [WS, "missing", NOW])
    })
})
