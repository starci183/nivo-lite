import type { InvoiceAccountingRow } from "@modules/domain/invoices"
import type { TransactionAccountingRow } from "@modules/domain/transactions"
import { buildLedger, customerOf, originOf, toMs } from "./ledger.policy"
import type { LedgerInput } from "./ledger.policy"

const CREATED = "2026-10-01T00:00:00.000Z"
const ISSUED = "2026-10-02T00:00:00.000Z"
const PAID = "2026-10-03T00:00:00.000Z"
const invoice = (patch: Partial<InvoiceAccountingRow> = {}): InvoiceAccountingRow => ({
    id: "invoice-1",
    workspace_id: "workspace-1",
    order_id: null,
    lead_id: null,
    invoice_no: "INV-1",
    amount_vnd: 120000,
    status: "issued",
    origin: "live",
    issued_by: null,
    paid_at: null,
    issued_at: ISSUED,
    due_at: null,
    created_at: CREATED,
    order: null,
    lead: null,
    ...patch,
})
const transaction = (patch: Partial<TransactionAccountingRow> = {}): TransactionAccountingRow => ({
    id: "tx-1",
    workspace_id: "workspace-1",
    inbound_event_id: null,
    amount_vnd: 120000,
    reference: "REF-1",
    payer: "An",
    invoice_id: null,
    status: "matched",
    origin: "live",
    channel: "bank",
    occurred_at: PAID,
    created_at: PAID,
    inbound: null,
    ...patch,
})
const input = (patch: Partial<LedgerInput> = {}): LedgerInput => ({
    invoices: [],
    transactions: [],
    works: [],
    decisions: [],
    adjustments: [],
    ...patch,
})

describe("ledger.policy", () => {
    it("normalizes origins, timestamps and customer labels", () => {
        expect(originOf("simulated")).toBe("simulated")
        expect(originOf("live")).toBe("live")
        expect(originOf(null)).toBe("live")
        expect(originOf("legacy")).toBe("live")
        expect(toMs(CREATED)).toBe(Date.parse(CREATED))
        expect(toMs(null)).toBeNaN()
        expect(toMs("invalid date")).toBeNaN()
        expect(customerOf(null)).toBeNull()
        expect(customerOf({ contact_name: "An", company: "Acme" })).toBe("An")
        expect(customerOf({ contact_name: "", company: "Acme" })).toBe("Acme")
        expect(customerOf({ contact_name: null, company: null })).toBeNull()
        expect(customerOf({ contact_name: "", company: "" })).toBeNull()
        expect(buildLedger(input())).toEqual([])
        expect(buildLedger(input({ invoices: [invoice({ status: "draft" })] }))).toEqual([])
    })

    it.each([
        {
            status: "issued",
            paid_at: null,
            issued_at: ISSUED,
            at: ISSUED,
            kind: "receivable",
            expectedStatus: "issued",
        },
        { status: "paid", paid_at: PAID, issued_at: ISSUED, at: PAID, kind: "income", expectedStatus: "paid" },
        { status: "paid", paid_at: null, issued_at: ISSUED, at: ISSUED, kind: "income", expectedStatus: "paid" },
        { status: "paid", paid_at: null, issued_at: null, at: CREATED, kind: "income", expectedStatus: "paid" },
        { status: "void", paid_at: PAID, issued_at: null, at: CREATED, kind: "receivable", expectedStatus: "void" },
        {
            status: "legacy",
            paid_at: PAID,
            issued_at: ISSUED,
            at: ISSUED,
            kind: "receivable",
            expectedStatus: "issued",
        },
    ])(
        "derives an invoice ledger row for $status with timestamp $at",
        ({ status, paid_at, issued_at, at, kind, expectedStatus }) => {
            expect(buildLedger(input({ invoices: [invoice({ status, paid_at, issued_at })] }))).toEqual([
                {
                    id: "inv:invoice-1",
                    targetType: "invoice",
                    targetId: "invoice-1",
                    at,
                    description: "INV-1",
                    kind,
                    amount: 120000,
                    status: expectedStatus,
                    linked: null,
                    origin: "live",
                    lineage: [
                        {
                            kind: "invoice",
                            title: "INV-1",
                            detail: null,
                            at: issued_at ?? CREATED,
                            status,
                            amount: 120000,
                        },
                    ],
                    adjustmentCount: 0,
                },
            ])
        },
    )

    it("builds settlement lineage in evidence order and includes each decision only once", () => {
        const firstPayment = {
            kind: "payment",
            title: "An",
            detail: "REF-1",
            at: "1970-01-01T00:00:00.000Z",
            status: "matched",
            amount: 120000,
        }
        const secondPayment = {
            kind: "payment",
            title: "REF-2",
            detail: "REF-2",
            at: PAID,
            status: "matched",
            amount: 30000,
        }
        const orderEvidence = {
            kind: "order",
            title: "ORDER-1",
            detail: "Services",
            at: null,
            status: "confirmed",
            amount: 150000,
        }
        const invoiceEvidence = {
            kind: "invoice",
            title: "INV-1",
            detail: "An",
            at: ISSUED,
            status: "paid",
            amount: 120000,
        }
        const decisions = [
            {
                kind: "decision",
                title: "auto_match",
                detail: null,
                at: "invalid date",
                status: "auto_done",
                amount: null,
            },
            {
                kind: "decision",
                title: "approve",
                detail: "Owner / Verified",
                at: "1970-01-01T00:00:00.000Z",
                status: "approved",
                amount: null,
            },
            { kind: "decision", title: "confirm", detail: "Staff", at: PAID, status: "edited", amount: null },
        ]
        const invoiceAdjustments = [
            { kind: "adjustment", title: "Owner", detail: "Note only", at: ISSUED, status: null, amount: null },
            { kind: "adjustment", title: "Staff", detail: "Corrected", at: PAID, status: null, amount: 115000 },
        ]
        const transactionAdjustment = {
            kind: "adjustment",
            title: "Owner",
            detail: "Bank correction",
            at: PAID,
            status: null,
            amount: 119000,
        }
        const ledger = buildLedger(
            input({
                invoices: [
                    invoice({
                        status: "paid",
                        paid_at: PAID,
                        origin: "simulated",
                        order_id: "invoice-1",
                        order: { order_no: "ORDER-1", items: "Services", amount_vnd: 150000, status: "confirmed" },
                        lead: { contact_name: "An", company: "Acme" },
                    }),
                ],
                transactions: [
                    transaction({ invoice_id: "invoice-1", occurred_at: "1970-01-01T00:00:00.000Z" }),
                    transaction({
                        id: "tx-2",
                        invoice_id: "invoice-1",
                        payer: null,
                        reference: "REF-2",
                        amount_vnd: 30000,
                    }),
                ],
                works: [
                    {
                        id: "work-1",
                        action: "auto_match",
                        status: "done",
                        subject_type: "invoice",
                        subject_id: "invoice-1",
                        created_at: CREATED,
                    },
                    {
                        id: "work-2",
                        action: "approve",
                        status: "done",
                        subject_type: "order",
                        subject_id: "invoice-1",
                        created_at: CREATED,
                    },
                    {
                        id: "work-3",
                        action: "confirm",
                        status: "done",
                        subject_type: "transaction",
                        subject_id: "tx-1",
                        created_at: CREATED,
                    },
                    {
                        id: "work-empty",
                        action: "confirm",
                        status: "done",
                        subject_type: "transaction",
                        subject_id: "tx-2",
                        created_at: CREATED,
                    },
                    {
                        id: "work-unlinked",
                        action: "confirm",
                        status: "done",
                        subject_type: "transaction",
                        subject_id: null,
                        created_at: CREATED,
                    },
                ],
                decisions: [
                    {
                        id: "d-1",
                        work_item_id: "work-1",
                        action: "auto_match",
                        decided_by: "NIVO",
                        decider_kind: "policy",
                        outcome: "auto_done",
                        note: null,
                        created_at: "invalid date",
                    },
                    {
                        id: "d-2",
                        work_item_id: "work-1",
                        action: "approve",
                        decided_by: "Owner",
                        decider_kind: "owner",
                        outcome: "approved",
                        note: "Verified",
                        created_at: "1970-01-01T00:00:00.000Z",
                    },
                    {
                        id: "d-3",
                        work_item_id: "work-3",
                        action: "confirm",
                        decided_by: "Staff",
                        decider_kind: "staff",
                        outcome: "edited",
                        note: null,
                        created_at: PAID,
                    },
                    {
                        id: "d-unlinked",
                        work_item_id: null,
                        action: "approve",
                        decided_by: "Owner",
                        decider_kind: "owner",
                        outcome: "approved",
                        note: null,
                        created_at: CREATED,
                    },
                ],
                adjustments: [
                    {
                        id: "a-2",
                        target_type: "invoice",
                        target_id: "invoice-1",
                        note: "Corrected",
                        corrected_amount_vnd: 115000,
                        created_by: "Staff",
                        created_at: PAID,
                    },
                    {
                        id: "a-1",
                        target_type: "invoice",
                        target_id: "invoice-1",
                        note: "Note only",
                        corrected_amount_vnd: null,
                        created_by: "Owner",
                        created_at: ISSUED,
                    },
                    {
                        id: "a-tx",
                        target_type: "transaction",
                        target_id: "tx-1",
                        note: "Bank correction",
                        corrected_amount_vnd: 119000,
                        created_by: "Owner",
                        created_at: PAID,
                    },
                ],
            }),
        )
        expect(ledger).toEqual([
            {
                id: "tx:tx-2",
                targetType: "transaction",
                targetId: "tx-2",
                at: PAID,
                description: "REF-2",
                kind: "income",
                amount: 30000,
                status: "matched",
                linked: "INV-1",
                origin: "live",
                lineage: [orderEvidence, invoiceEvidence, secondPayment, ...decisions.slice(0, 2)],
                adjustmentCount: 0,
            },
            {
                id: "inv:invoice-1",
                targetType: "invoice",
                targetId: "invoice-1",
                at: ISSUED,
                description: "INV-1 / An",
                kind: "receivable",
                amount: 120000,
                status: "settled",
                linked: "ORDER-1",
                origin: "simulated",
                lineage: [
                    orderEvidence,
                    invoiceEvidence,
                    firstPayment,
                    secondPayment,
                    ...decisions,
                    ...invoiceAdjustments,
                ],
                adjustmentCount: 2,
            },
            {
                id: "tx:tx-1",
                targetType: "transaction",
                targetId: "tx-1",
                at: "1970-01-01T00:00:00.000Z",
                description: "An / REF-1",
                kind: "income",
                amount: 120000,
                status: "matched",
                linked: "INV-1",
                origin: "live",
                lineage: [orderEvidence, invoiceEvidence, firstPayment, ...decisions, transactionAdjustment],
                adjustmentCount: 1,
            },
        ])
    })

    it("keeps empty order labels and absent order amounts as null", () => {
        const ledger = buildLedger(
            input({
                invoices: [
                    invoice({
                        order: { order_no: "ORDER-2", items: "", amount_vnd: null, status: "new" },
                        lead: { contact_name: "", company: "Acme" },
                    }),
                ],
            }),
        )
        expect(ledger).toEqual([
            {
                id: "inv:invoice-1",
                targetType: "invoice",
                targetId: "invoice-1",
                at: ISSUED,
                description: "INV-1 / Acme",
                kind: "receivable",
                amount: 120000,
                status: "issued",
                linked: "ORDER-2",
                origin: "live",
                adjustmentCount: 0,
                lineage: [
                    { kind: "order", title: "ORDER-2", detail: null, at: null, status: "new", amount: null },
                    { kind: "invoice", title: "INV-1", detail: "Acme", at: ISSUED, status: "issued", amount: 120000 },
                ],
            },
        ])
    })

    it.each([
        ["issued", "An", "REF-1", null, "An / REF-1", "An", "issued"],
        ["paid", "An", null, "missing", "An", "An", "paid"],
        ["void", null, "REF-1", null, "REF-1", "REF-1", "void"],
        ["settled", null, null, null, "-", "-", "settled"],
        ["matched", "", "", null, "-", "-", "matched"],
        ["unmatched", "An", "REF-1", null, "An / REF-1", "An", "unmatched"],
        ["needs_review", "An", "REF-1", null, "An / REF-1", "An", "needs_review"],
        ["legacy", "An", "REF-1", null, "An / REF-1", "An", "unmatched"],
    ] as const)(
        "normalizes an unlinked %s payment",
        (status, payer, reference, invoice_id, label, title, expectedStatus) => {
            expect(
                buildLedger(
                    input({
                        transactions: [transaction({ status, payer, reference, invoice_id, origin: "simulated" })],
                    }),
                ),
            ).toEqual([
                {
                    id: "tx:tx-1",
                    targetType: "transaction",
                    targetId: "tx-1",
                    at: PAID,
                    description: label,
                    kind: "income",
                    amount: 120000,
                    status: expectedStatus,
                    linked: null,
                    origin: "simulated",
                    adjustmentCount: 0,
                    lineage: [{ kind: "payment", title, detail: reference, at: PAID, status, amount: 120000 }],
                },
            ])
        },
    )

    it("returns at most the 400 newest entries", () => {
        const transactions = Array.from({ length: 401 }, (_, index) =>
            transaction({
                id: `tx-${index}`,
                occurred_at: new Date(Date.parse(PAID) + index * 1000).toISOString(),
            }),
        )
        const ledger = buildLedger(input({ transactions }))
        expect(ledger).toHaveLength(400)
        expect(ledger.map((entry) => entry.id)).toEqual(
            Array.from({ length: 400 }, (_, index) => `tx:tx-${400 - index}`),
        )
        expect(ledger[0]).toEqual({
            id: "tx:tx-400",
            targetType: "transaction",
            targetId: "tx-400",
            at: "2026-10-03T00:06:40.000Z",
            description: "An / REF-1",
            kind: "income",
            amount: 120000,
            status: "matched",
            linked: null,
            origin: "live",
            adjustmentCount: 0,
            lineage: [
                {
                    kind: "payment",
                    title: "An",
                    detail: "REF-1",
                    at: "2026-10-03T00:06:40.000Z",
                    status: "matched",
                    amount: 120000,
                },
            ],
        })
    })
})
