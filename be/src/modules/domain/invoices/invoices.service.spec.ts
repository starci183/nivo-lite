import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { InvoicesErrorCode } from "./errors/invoices.error"
import type { NewInvoice, NewRenewalInvoice } from "./invoices.contracts"
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
    FIND_CONTRACT_PERIOD_INVOICE,
    FIND_INVOICE,
    FIND_INVOICE_OF_ORDER,
    FIND_LATEST_LEAD_INVOICE,
    INSERT_INVOICE,
    INSERT_RENEWAL_INVOICE,
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
    contract_id: null,
    period_ends_on: null,
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
const CONTRACT = "c1"
const PERIOD = "2026-11-30"
const RENEWAL: InvoiceRow = {
    ...INVOICE,
    id: "inv-r1",
    order_id: null,
    invoice_no: "INV-202610-0043",
    amount_vnd: 900_000,
    issued_by: null,
    contract_id: CONTRACT,
    period_ends_on: PERIOD,
}
const RENEWAL_INPUT: NewRenewalInvoice = {
    workspaceId: WS,
    contractId: CONTRACT,
    leadId: "l1",
    amountVnd: 900_000,
    periodEndsOn: PERIOD,
    issuedBy: null,
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

describe("InvoicesService renewals", () => {
    it("issues a renewal invoice for a contract period with the next number, no order and the term due date", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_CONTRACT_PERIOD_INVOICE, []],
                [LAST_INVOICE_NUMBER, [{ invoice_no: "INV-202610-0042" }]],
                [INSERT_RENEWAL_INVOICE, [RENEWAL]],
            ],
        })
        const service = await build(em)

        await expect(service.issueRenewal(RENEWAL_INPUT)).resolves.toEqual({ invoice: RENEWAL, created: true })
        expect(em.query.mock.calls).toEqual([
            [FIND_CONTRACT_PERIOD_INVOICE, [WS, CONTRACT, PERIOD]],
            [LAST_INVOICE_NUMBER, [WS, "INV-202610-"]],
            [INSERT_RENEWAL_INVOICE, [WS, CONTRACT, PERIOD, "l1", "INV-202610-0043", 900_000, DUE_AT, null, NOW]],
        ])
    })

    it("answers the existing renewal invoice of the period without issuing another", async () => {
        const em = mockEntityManager({ query: [FIND_CONTRACT_PERIOD_INVOICE, [RENEWAL]] })
        const service = await build(em)

        await expect(service.issueRenewal(RENEWAL_INPUT)).resolves.toEqual({ invoice: RENEWAL, created: false })
        expect(em.query.mock.calls).toEqual([[FIND_CONTRACT_PERIOD_INVOICE, [WS, CONTRACT, PERIOD]]])
    })

    it("issues a new invoice for the next period of the same contract", async () => {
        const next = { ...RENEWAL, id: "inv-r2", invoice_no: "INV-202610-0044", period_ends_on: "2026-12-31" }
        const em = mockEntityManager({
            query: [
                [FIND_CONTRACT_PERIOD_INVOICE, []],
                [LAST_INVOICE_NUMBER, [{ invoice_no: "INV-202610-0043" }]],
                [INSERT_RENEWAL_INVOICE, [next]],
            ],
        })
        const service = await build(em)

        await expect(service.issueRenewal({ ...RENEWAL_INPUT, periodEndsOn: "2026-12-31" })).resolves.toEqual({
            invoice: next,
            created: true,
        })
        expect(em.query.mock.calls).toEqual([
            [FIND_CONTRACT_PERIOD_INVOICE, [WS, CONTRACT, "2026-12-31"]],
            [LAST_INVOICE_NUMBER, [WS, "INV-202610-"]],
            [INSERT_RENEWAL_INVOICE, [WS, CONTRACT, "2026-12-31", "l1", "INV-202610-0044", 900_000, DUE_AT, null, NOW]],
        ])
    })
})

describe("InvoicesService renewals", () => {
    it("tries the following number when only the number clashed", async () => {
        const created = { ...RENEWAL, invoice_no: "INV-202610-0002" }
        const em = mockEntityManager({
            query: [
                [FIND_CONTRACT_PERIOD_INVOICE, []],
                [LAST_INVOICE_NUMBER, []],
                [INSERT_RENEWAL_INVOICE, []],
                [FIND_CONTRACT_PERIOD_INVOICE, []],
                [INSERT_RENEWAL_INVOICE, [created]],
            ],
        })
        const service = await build(em)

        await expect(service.issueRenewal(RENEWAL_INPUT)).resolves.toEqual({ invoice: created, created: true })
        expect(em.query.mock.calls).toEqual([
            [FIND_CONTRACT_PERIOD_INVOICE, [WS, CONTRACT, PERIOD]],
            [LAST_INVOICE_NUMBER, [WS, "INV-202610-"]],
            [INSERT_RENEWAL_INVOICE, [WS, CONTRACT, PERIOD, "l1", "INV-202610-0001", 900_000, DUE_AT, null, NOW]],
            [FIND_CONTRACT_PERIOD_INVOICE, [WS, CONTRACT, PERIOD]],
            [INSERT_RENEWAL_INVOICE, [WS, CONTRACT, PERIOD, "l1", "INV-202610-0002", 900_000, DUE_AT, null, NOW]],
        ])
    })

    it("answers the renewal a concurrent issuer wrote after the insert conflicted", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_CONTRACT_PERIOD_INVOICE, []],
                [LAST_INVOICE_NUMBER, []],
                [INSERT_RENEWAL_INVOICE, []],
                [FIND_CONTRACT_PERIOD_INVOICE, [RENEWAL]],
            ],
        })
        const service = await build(em)

        await expect(service.issueRenewal(RENEWAL_INPUT)).resolves.toEqual({ invoice: RENEWAL, created: false })
        expect(em.query).toHaveBeenCalledTimes(4)
    })

    it("gives up a renewal after four taken numbers", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_CONTRACT_PERIOD_INVOICE, []],
                [LAST_INVOICE_NUMBER, []],
                [INSERT_RENEWAL_INVOICE, []],
            ],
        })
        const service = await build(em)

        await expect(service.issueRenewal(RENEWAL_INPUT)).rejects.toMatchObject({
            code: InvoicesErrorCode.NotNumbered,
        })
        expect(em.query.mock.calls.filter(([statement]) => statement === INSERT_RENEWAL_INVOICE)).toHaveLength(4)
    })
})

describe("InvoicesService renewals", () => {
    it("reads the renewal invoice of a contract period, or null when it has none", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_CONTRACT_PERIOD_INVOICE, [RENEWAL]],
                [FIND_CONTRACT_PERIOD_INVOICE, []],
            ],
        })
        const service = await build(em)

        await expect(service.forContractPeriod(WS, CONTRACT, PERIOD)).resolves.toEqual(RENEWAL)
        await expect(service.forContractPeriod(WS, CONTRACT, "2026-12-31")).resolves.toBeNull()
        expect(em.query.mock.calls).toEqual([
            [FIND_CONTRACT_PERIOD_INVOICE, [WS, CONTRACT, PERIOD]],
            [FIND_CONTRACT_PERIOD_INVOICE, [WS, CONTRACT, "2026-12-31"]],
        ])
    })

    it("carries the contract and period through find and markPaid", async () => {
        const paid = { ...RENEWAL, status: "paid", paid_at: NOW }
        const em = mockEntityManager({
            query: [
                [FIND_INVOICE, [RENEWAL]],
                [MARK_INVOICE_PAID, [paid]],
            ],
        })
        const service = await build(em)

        await expect(service.find(WS, "inv-r1")).resolves.toMatchObject({ contract_id: CONTRACT, period_ends_on: PERIOD })
        await expect(service.markPaid(WS, "inv-r1")).resolves.toMatchObject({
            contract_id: CONTRACT,
            period_ends_on: PERIOD,
            status: "paid",
        })
    })

    it.each([
        FIND_INVOICE,
        FIND_INVOICE_OF_ORDER,
        FIND_LATEST_LEAD_INVOICE,
        FIND_CONTRACT_PERIOD_INVOICE,
        INSERT_INVOICE,
        INSERT_RENEWAL_INVOICE,
        MARK_INVOICE_PAID,
    ])("selects the contract and its period in invoice statement %#", (statement) => {
        expect(String(statement)).toContain("contract_id")
        expect(String(statement)).toContain("period_ends_on::text AS period_ends_on")
    })
})
