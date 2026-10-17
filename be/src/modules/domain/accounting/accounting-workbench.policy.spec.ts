import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { AccountingWaitingWorkRow } from "@modules/domain/decisions"
import type { InvoiceAccountingRow } from "@modules/domain/invoices"
import type { TransactionAccountingRow } from "@modules/domain/transactions"
import type { AccountingBook, BookOrder } from "./accounting-book.contracts"
import { buildAccountingWorkbench } from "./accounting-workbench.policy"

const SUBJECT = Symbol("accounting-workbench.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { buildAccountingWorkbench } }],
    }).compile()
    return moduleRef.get<typeof import("./accounting-workbench.policy")>(SUBJECT)
}

const registerPeriodTotals = () => {
    it("uses Vietnam month boundaries, fallback invoice dates and separate weekly income by origin", async () => {
        const subject = await buildSubject()
        const invoices = [
            invoiceOf({ id: "paid", status: "paid", paid_at: "2026-10-02T00:00:00.000Z" }),
            invoiceOf({
                id: "paid-issued",
                status: "paid",
                issued_at: "2026-10-07T00:00:00.000Z",
                amount_vnd: 200,
                origin: "simulated",
            }),
            invoiceOf({
                id: "paid-created",
                status: "paid",
                issued_at: null,
                created_at: "2026-10-14T00:00:00.000Z",
                amount_vnd: 300,
            }),
            invoiceOf({ id: "paid-last", status: "paid", paid_at: "2026-09-01T00:00:00.000Z", amount_vnd: 400 }),
            invoiceOf({ id: "paid-old", status: "paid", paid_at: "2026-08-31T16:59:59.999Z", amount_vnd: 500 }),
            invoiceOf({ id: "paid-next", status: "paid", paid_at: "2026-10-31T17:00:00.000Z", amount_vnd: 600 }),
            invoiceOf({ id: "paid-invalid", status: "paid", paid_at: "invalid", amount_vnd: 700 }),
            invoiceOf({ id: "issued", amount_vnd: 800 }),
            invoiceOf({ id: "issued-created", issued_at: null, amount_vnd: 900, origin: "simulated" }),
            invoiceOf({ id: "issued-last", issued_at: "2026-09-30T16:59:59.999Z", amount_vnd: 1000 }),
            invoiceOf({ id: "issued-invalid", issued_at: "invalid", amount_vnd: 1100 }),
            invoiceOf({ id: "draft", status: "draft", amount_vnd: 1200 }),
            invoiceOf({ id: "void", status: "void", amount_vnd: 1300 }),
        ]
        const transactions = [
            txOf({ id: "this-boundary", occurred_at: "2026-09-30T17:00:00.000Z" }),
            txOf({ id: "matched-orphan", status: "matched", amount_vnd: 20, origin: "simulated" }),
            txOf({ id: "matched", status: "matched", invoice_id: "issued", amount_vnd: 30 }),
            txOf({
                id: "last-boundary",
                occurred_at: "2026-08-31T17:00:00.000Z",
                status: "needs_review",
                amount_vnd: 40,
                origin: "simulated",
            }),
            txOf({ id: "next", occurred_at: "2026-10-31T17:00:00.000Z", amount_vnd: 60 }),
            txOf({ id: "invalid", occurred_at: "invalid", amount_vnd: 70 }),
        ]
        const result = workbenchOf(subject, bookOf({ invoices, transactions }))

        expect(result.periods).toEqual({
            this: {
                key: "this",
                fromIso: "2026-09-30T17:00:00.000Z",
                toIso: "2026-10-31T17:00:00.000Z",
                income: measure(400, 200, 2, 1),
                receivable: measure(800, 900, 1, 1),
                unmatched: measure(10, 20, 1, 1),
                weeks: [
                    { startIso: "2026-09-27T17:00:00.000Z", live: 100, simulated: 0 },
                    { startIso: "2026-10-04T17:00:00.000Z", live: 0, simulated: 200 },
                    { startIso: "2026-10-11T17:00:00.000Z", live: 300, simulated: 0 },
                    { startIso: "2026-10-18T17:00:00.000Z", live: 0, simulated: 0 },
                    { startIso: "2026-10-25T17:00:00.000Z", live: 0, simulated: 0 },
                ],
            },
            last: {
                key: "last",
                fromIso: "2026-08-31T17:00:00.000Z",
                toIso: "2026-09-30T17:00:00.000Z",
                income: measure(400, 0, 1, 0),
                receivable: measure(1000, 0, 1, 0),
                unmatched: measure(0, 40, 0, 1),
                weeks: [
                    { startIso: "2026-08-30T17:00:00.000Z", live: 400, simulated: 0 },
                    { startIso: "2026-09-06T17:00:00.000Z", live: 0, simulated: 0 },
                    { startIso: "2026-09-13T17:00:00.000Z", live: 0, simulated: 0 },
                    { startIso: "2026-09-20T17:00:00.000Z", live: 0, simulated: 0 },
                    { startIso: "2026-09-27T17:00:00.000Z", live: 0, simulated: 0 },
                ],
            },
        })
    })
}

const registerInvoiceAgeing = () => {
    it("ages all open invoices at the 30 and 60 day edges using due, issued and creation dates", async () => {
        const subject = await buildSubject()

        const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()
        const result = workbenchOf(
            subject,
            bookOf({
                invoices: [
                    invoiceOf({ id: "30", due_at: daysAgo(30), amount_vnd: 30 }),
                    invoiceOf({ id: "31", due_at: daysAgo(31), amount_vnd: 31, origin: "simulated" }),
                    invoiceOf({ id: "60", issued_at: daysAgo(60), amount_vnd: 60 }),
                    invoiceOf({
                        id: "61",
                        issued_at: null,
                        created_at: daysAgo(61),
                        amount_vnd: 61,
                        origin: "simulated",
                    }),
                    invoiceOf({ id: "invalid", due_at: "invalid", amount_vnd: 2 }),
                    invoiceOf({ id: "paid", status: "paid", due_at: daysAgo(90), amount_vnd: 90 }),
                ],
            }),
        )

        expect(result.ageing).toEqual({
            d0: measure(32, 0, 2, 0),
            d30: measure(60, 31, 1, 1),
            d60: measure(0, 61, 0, 1),
        })
    })
}

const registerWaitingWork = () => {
    it("keeps only accounting work waiting for a decision and groups every reason with known and unknown amounts", async () => {
        const subject = await buildSubject()

        const items = [
            itemOf({
                id: "payment",
                action: "reconcile_payment",
                reason: "over_authority",
                subject_type: "transaction",
                subject_id: "waiting-tx",
                proposal: { summary: "Reconcile", amount_vnd: 100, fields: {} },
            }),
            itemOf({
                id: "limit",
                reason: "over_authority",
                proposal: { summary: "Issue", amount_vnd: 0, fields: {} },
            }),
            itemOf({ id: "missing-reason", reason: "missing_data", origin: "simulated" }),
            itemOf({
                id: "missing-field",
                missing_fields: ["customer"],
                proposal: { summary: "Issue", amount_vnd: null, fields: {} },
            }),
            itemOf({ id: "other" }),
            itemOf({ id: "sales", department: "sales" }),
            itemOf({ id: "done", status: "done" }),
            itemOf({ id: "test", proposal: { summary: "UAT issue", amount_vnd: 999, fields: {} } }),
        ]
        const result = workbenchOf(subject, bookOf({ transactions: [txOf({ id: "waiting-tx" })] }), items)

        expect(result.questions).toEqual([
            { item: items[0], group: "unclear_payment" },
            { item: items[1], group: "over_limit" },
            { item: items[2], group: "missing_data" },
            { item: items[3], group: "missing_data" },
            { item: items[4], group: "other" },
        ])
        expect(result.waiting).toEqual({ count: { live: 4, simulated: 1 }, knownVnd: 100, unknownAmount: 3 })
        expect(result.credits[0]).toEqual({
            id: "waiting-tx",
            occurredAt: "2026-10-01T00:00:00.000Z",
            amount: 10,
            payer: "Mai",
            reference: "Payment",
            origin: "live",
            match: "unclear",
            invoiceNo: null,
            sourceKind: "other",
        })
    })
}

const registerPaymentEvidence = () => {
    it("maps invoice links and every bank-credit source and match state", async () => {
        const subject = await buildSubject()

        const inbound = { channel: "bank", event_id: "vietcombank:credit-1", body: "Payment", sender_name: "Mai" }
        const result = workbenchOf(
            subject,
            bookOf({
                invoices: [invoiceOf()],
                transactions: [
                    txOf({ id: "bank", status: "matched", invoice_id: "invoice-1", inbound }),
                    txOf({
                        id: "manual",
                        status: "needs_review",
                        inbound: { ...inbound, channel: "manual", event_id: "entry-1" },
                    }),
                    txOf({ id: "inbox", status: "matched", inbound: { ...inbound, event_id: null } }),
                    txOf({ id: "orphan", status: "matched", invoice_id: "missing-invoice" }),
                    txOf({ id: "unmatched" }),
                ],
            }),
        )

        expect(
            result.credits.map(({ id, match, invoiceNo, sourceKind }) => ({ id, match, invoiceNo, sourceKind })),
        ).toEqual([
            { id: "bank", match: "matched", invoiceNo: "INV-1", sourceKind: "vietcombank" },
            { id: "manual", match: "unclear", invoiceNo: null, sourceKind: "manual" },
            { id: "inbox", match: "unclear", invoiceNo: null, sourceKind: "inbox" },
            { id: "orphan", match: "matched", invoiceNo: null, sourceKind: "other" },
            { id: "unmatched", match: "unmatched", invoiceNo: null, sourceKind: "other" },
        ])
    })
}

const registerLiveRecords = () => {
    it("excludes test records before figures and ledger and maps uninvoiced, noncancelled orders", async () => {
        const subject = await buildSubject()

        const linkedOrder = { order_no: "SO-linked", items: "Cake", amount_vnd: 100, status: "invoiced" }
        const result = workbenchOf(
            subject,
            bookOf({
                invoices: [
                    invoiceOf({
                        order_id: "linked",
                        order: linkedOrder,
                        lead: { contact_name: "Mai", company: "Bakery" },
                    }),
                    invoiceOf({ id: "unknown", invoice_no: "INV-unknown", status: "legacy" }),
                    invoiceOf({ id: "test-invoice", invoice_no: "UAT-1" }),
                ],
                transactions: [
                    txOf({
                        id: "test-tx",
                        inbound: { channel: "manual", event_id: null, body: "test", sender_name: "DBG sender" },
                    }),
                ],
                orders: [
                    orderOf({ id: "linked" }),
                    orderOf({ id: "cancelled", status: "cancelled" }),
                    orderOf({ id: "live", lead: { contact_name: "", company: "Bakery" } }),
                    orderOf({ id: "unknown-amount", order_no: "SO-2", amount_vnd: null, origin: "simulated" }),
                    orderOf({ id: "test-order", items: "DBG cake" }),
                ],
            }),
        )

        expect(result.excludedTest).toBe(3)
        expect(result.invoices).toEqual(expectedInvoices)
        expect(result.ordersWithoutInvoice).toEqual([
            {
                id: "live",
                orderNo: "SO-1",
                items: "2 cakes",
                amount: 200,
                origin: "live",
                customer: "Bakery",
                createdAt: "2026-10-01T00:00:00.000Z",
            },
            {
                id: "unknown-amount",
                orderNo: "SO-2",
                items: "2 cakes",
                amount: null,
                origin: "simulated",
                customer: null,
                createdAt: "2026-10-01T00:00:00.000Z",
            },
        ])
        expect(result.credits).toEqual([])
        expect(result.periods.this.receivable).toEqual(measure(100, 0, 1, 0))
        expect(result.ledger.map((entry) => entry.targetId)).toEqual(["invoice-1", "unknown"])
    })

    it("limits invoice and credit evidence to the first 200 without limiting the figures", async () => {
        const subject = await buildSubject()

        const invoices = Array.from({ length: 201 }, (_, index) => invoiceOf({ id: `invoice-${index}` }))
        const transactions = Array.from({ length: 201 }, (_, index) => txOf({ id: `tx-${index}` }))
        const result = workbenchOf(subject, bookOf({ invoices, transactions }))

        expect(result.invoices.map((invoice) => invoice.id)).toEqual(
            invoices.slice(0, 200).map((invoice) => invoice.id),
        )
        expect(result.credits.map((tx) => tx.id)).toEqual(transactions.slice(0, 200).map((tx) => tx.id))
        expect(result.periods.this.receivable).toEqual(measure(20100, 0, 201, 0))
        expect(result.periods.this.unmatched).toEqual(measure(2010, 0, 201, 0))
        expect(result.ledger).toHaveLength(400)
    })
}

const registerCorrectionPermissions = () => {
    it.each([
        { ready: true, role: "owner", allowed: true },
        { ready: true, role: "manager", allowed: true },
        { ready: true, role: "staff", allowed: false },
        { ready: false, role: "owner", allowed: false },
    ])(
        "allows corrections only when persistence is ready for an owner or manager: $role/$ready",
        async ({ ready, role, allowed }) => {
            const subject = await buildSubject()

            const result = workbenchOf(subject, bookOf({ adjustmentsReady: ready }), [], role)

            expect(result.canAdjust).toBe(allowed)
            expect(result.adjustmentsReady).toBe(ready)
            expect(result.ownerName).toBe("Lan")
            expect(result.now).toBe(NOW.toISOString())
        },
    )
}

const expectedInvoices = [
    {
        id: "invoice-1",
        invoiceNo: "INV-1",
        amount: 100,
        status: "issued",
        origin: "live",
        customer: "Mai",
        issuedAt: "2026-10-01T00:00:00.000Z",
        paidAt: null,
        dueAt: null,
        createdAt: "2026-10-01T00:00:00.000Z",
        orderNo: "SO-linked",
    },
    {
        id: "unknown",
        invoiceNo: "INV-unknown",
        amount: 100,
        status: "draft",
        origin: "live",
        customer: null,
        issuedAt: "2026-10-01T00:00:00.000Z",
        paidAt: null,
        dueAt: null,
        createdAt: "2026-10-01T00:00:00.000Z",
        orderNo: null,
    },
]

const NOW = new Date("2026-10-15T10:00:00.000Z")
const invoiceOf = builder<InvoiceAccountingRow>({
    id: "invoice-1",
    workspace_id: "ws-1",
    order_id: null,
    lead_id: null,
    invoice_no: "INV-1",
    amount_vnd: 100,
    status: "issued",
    origin: "live",
    issued_by: "Lan",
    paid_at: null,
    issued_at: "2026-10-01T00:00:00.000Z",
    due_at: null,
    created_at: "2026-10-01T00:00:00.000Z",
    order: null,
    lead: null,
})
const txOf = builder<TransactionAccountingRow>({
    id: "tx-1",
    workspace_id: "ws-1",
    inbound_event_id: null,
    amount_vnd: 10,
    reference: "Payment",
    payer: "Mai",
    invoice_id: null,
    status: "unmatched",
    origin: "live",
    channel: "bank",
    occurred_at: "2026-10-01T00:00:00.000Z",
    created_at: "2026-10-01T00:00:00.000Z",
    inbound: null,
})
const orderOf = builder<BookOrder>({
    id: "order-1",
    workspace_id: "ws-1",
    lead_id: null,
    inbound_event_id: null,
    order_no: "SO-1",
    items: "2 cakes",
    amount_vnd: 200,
    status: "confirmed",
    origin: "live",
    confirmed_by: null,
    confirmed_at: null,
    created_at: "2026-10-01T00:00:00.000Z",
    shipped_at: null,
    carrier: null,
    tracking_code: null,
    contact_name: null,
    company: null,
    lead: null,
})
const itemOf = builder<AccountingWaitingWorkRow>({
    id: "work-1",
    workspace_id: "ws-1",
    department: "accounting",
    action: "issue_invoice",
    subject_type: "invoice",
    subject_id: "invoice-1",
    lead_id: null,
    inbound_event_id: null,
    parent_id: null,
    chain_id: null,
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Issue payment record", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    assigned_staff_name: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    completed_at: null,
    installation_id: null,
    lead: null,
})
const bookOf = builder<AccountingBook>({
    invoices: [],
    transactions: [],
    orders: [],
    works: [],
    decisions: [],
    adjustments: [],
    adjustmentsReady: true,
})
const workbenchOf = (
    subject: typeof import("./accounting-workbench.policy"),
    book: AccountingBook,
    exceptions: ReadonlyArray<AccountingWaitingWorkRow> = [],
    role = "owner",
) => subject.buildAccountingWorkbench({ book, now: NOW, exceptions, staff: [], ownerName: "Lan", role })
const measure = (live: number, simulated: number, liveCount: number, simulatedCount: number) => ({
    vnd: { live, simulated },
    count: { live: liveCount, simulated: simulatedCount },
})

describe("buildAccountingWorkbench", () => {
    registerPeriodTotals()
    registerInvoiceAgeing()
    registerWaitingWork()
    registerPaymentEvidence()
    registerLiveRecords()
    registerCorrectionPermissions()
})
