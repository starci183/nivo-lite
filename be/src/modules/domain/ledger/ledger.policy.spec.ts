import {
    CREATED,
    ISSUED,
    PAID,
    invoice,
    transaction,
    input,
    settlementInput,
    settlementExpected,
} from "../../../tests/fixtures/builders/ledger.builder"
import { paidPayableRow, payableRow } from "../../../tests/fixtures/builders/supplier-payables.builder"
import { Test } from "@nestjs/testing"
import { buildLedger, customerOf, toMs } from "./ledger.policy"

const SUBJECT = Symbol("ledger.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { buildLedger, customerOf, toMs } }],
    }).compile()
    return moduleRef.get<typeof import("./ledger.policy")>(SUBJECT)
}

describe("ledger.policy", () => {
    it("normalizes timestamps and customer labels", async () => {
        const subject = await build()

        expect(subject.toMs(CREATED)).toBe(Date.parse(CREATED))
        expect(subject.toMs(null)).toBeNaN()
        expect(subject.toMs("invalid date")).toBeNaN()
        expect(subject.customerOf(null)).toBeNull()
        expect(subject.customerOf({ contact_name: "An", company: "Acme" })).toBe("An")
        expect(subject.customerOf({ contact_name: "", company: "Acme" })).toBe("Acme")
        expect(subject.customerOf({ contact_name: null, company: null })).toBeNull()
        expect(subject.customerOf({ contact_name: "", company: "" })).toBeNull()
        expect(subject.buildLedger(input())).toEqual([])
        expect(subject.buildLedger(input({ invoices: [invoice({ status: "draft" })] }))).toEqual([])
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
        async ({ status, paid_at, issued_at, at, kind, expectedStatus }) => {
            const subject = await build()

            expect(subject.buildLedger(input({ invoices: [invoice({ status, paid_at, issued_at })] }))).toEqual([
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
})

describe("ledger.policy", () => {
    it("builds settlement lineage in evidence order and includes each decision only once", async () => {
        const subject = await build()

        const ledger = subject.buildLedger(settlementInput)
        expect(ledger).toEqual(settlementExpected)
    })

    it("keeps empty order labels and absent order amounts as null", async () => {
        const subject = await build()

        const ledger = subject.buildLedger(
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
                adjustmentCount: 0,
                lineage: [
                    { kind: "order", title: "ORDER-2", detail: null, at: null, status: "new", amount: null },
                    { kind: "invoice", title: "INV-1", detail: "Acme", at: ISSUED, status: "issued", amount: 120000 },
                ],
            },
        ])
    })
})

describe("ledger.policy", () => {
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
        async (status, payer, reference, invoice_id, label, title, expectedStatus) => {
            const subject = await build()

            expect(
                subject.buildLedger(
                    input({
                        transactions: [transaction({ status, payer, reference, invoice_id })],
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
                    adjustmentCount: 0,
                    lineage: [{ kind: "payment", title, detail: reference, at: PAID, status, amount: 120000 }],
                },
            ])
        },
    )
})

describe("ledger.policy", () => {
    it("returns at most the 400 newest entries", async () => {
        const subject = await build()

        const transactions = Array.from({ length: 401 }, (_, index) =>
            transaction({
                id: `tx-${index}`,
                occurred_at: new Date(Date.parse(PAID) + index * 1000).toISOString(),
            }),
        )
        const ledger = subject.buildLedger(input({ transactions }))
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

const EXPENSE_WORK = {
    id: "work-1",
    action: "confirm_supplier_payment",
    status: "done",
    subject_type: "supplier_payable",
    subject_id: "pay-1",
    created_at: PAID,
} as const

const EXPENSE_DECISION = {
    id: "decision-1",
    work_item_id: "work-1",
    action: "confirm_supplier_payment",
    decided_by: "NIVO",
    decider_kind: "policy",
    outcome: "auto_done",
    note: null,
    created_at: PAID,
} as const

const registerExpenseLine = () => {
    it("draws a paid supplier invoice as one expense line with its invoice, payment and decision", async () => {
        const subject = await build()

        const ledger = subject.buildLedger(
            input({
                payables: [paidPayableRow({ paidAt: PAID })],
                works: [EXPENSE_WORK],
                decisions: [EXPENSE_DECISION],
            }),
        )

        expect(ledger).toEqual([
            {
                id: "pay:pay-1",
                targetType: "supplier_payable",
                targetId: "pay-1",
                at: PAID,
                description: "Linh An / 17",
                kind: "expense",
                amount: 4620000,
                status: "paid",
                linked: "17",
                adjustmentCount: 0,
                lineage: [
                    { kind: "invoice", title: "17", detail: "Linh An", at: "2026-10-01", status: "paid", amount: 4620000 },
                    { kind: "payment", title: "d-1", detail: "Lan", at: PAID, status: "paid", amount: 4620000 },
                    {
                        kind: "decision",
                        title: "confirm_supplier_payment",
                        detail: null,
                        at: PAID,
                        status: "auto_done",
                        amount: null,
                    },
                ],
            },
        ])
    })
}

const registerExpenseEdges = () => {
    it("draws no line for an open supplier invoice", async () => {
        const subject = await build()

        expect(subject.buildLedger(input({ payables: [payableRow()] }))).toEqual([])
    })

    it("falls back to the first sighting for a paid invoice with no payment time and leaves an empty supplier out", async () => {
        const subject = await build()

        const [entry] = subject.buildLedger(
            input({ payables: [paidPayableRow({ paidAt: null, supplier: "", debitRef: null })] }),
        )

        expect(entry).toMatchObject({ at: "2026-10-15T00:00:00.000Z", description: "17" })
        expect(entry?.lineage.map((step) => [step.kind, step.title, step.detail])).toEqual([
            ["invoice", "17", null],
            ["payment", "-", "Lan"],
        ])
    })

    it("sorts an expense among income by time", async () => {
        const subject = await build()

        const ledger = subject.buildLedger(
            input({
                payables: [paidPayableRow({ paidAt: "2026-10-05T00:00:00.000Z" })],
                transactions: [transaction()],
            }),
        )

        expect(ledger.map((entry) => entry.kind)).toEqual(["expense", "income"])
    })
}

describe("ledger.policy expenses", () => {
    registerExpenseLine()
    registerExpenseEdges()
})
