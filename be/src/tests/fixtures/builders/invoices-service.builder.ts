import { mockEntityManager, type MockEntityManager } from "@starci/jest-preset"
import type { InvoiceRow, NewInvoice, NewRenewalInvoice } from "@modules/domain/invoices"
import {
    queueQueryBuilders,
    type FakeQueryBuilder,
    type QueryBuilderAnswers,
} from "./entity-query-builder-fake.builder"

export const WS = "11111111-1111-4111-8111-111111111111"
export const INVOICE: InvoiceRow = {
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
export const NOW = "2026-10-13T10:00:00.000Z"
export const DUE_AT = "2026-10-28T10:00:00.000Z"
export const INPUT: NewInvoice = { workspaceId: WS, orderId: "o1", leadId: "l1", amountVnd: 50_000, issuedBy: "Lan" }
export const CONTRACT = "c1"
export const PERIOD = "2026-11-30"
export const RENEWAL: InvoiceRow = {
    ...INVOICE,
    id: "inv-r1",
    order_id: null,
    invoice_no: "INV-202610-0043",
    amount_vnd: 900_000,
    issued_by: null,
    contract_id: CONTRACT,
    period_ends_on: PERIOD,
}
export const RENEWAL_INPUT: NewRenewalInvoice = {
    workspaceId: WS,
    contractId: CONTRACT,
    leadId: "l1",
    amountVnd: 900_000,
    periodEndsOn: PERIOD,
    issuedBy: null,
}
type QueuedResultShape = {
    em: MockEntityManager
    fakes: ReadonlyArray<FakeQueryBuilder>
}

/** A manager that hands out one query builder per call, answering `answers` in order. */
export const queued = (answers: ReadonlyArray<QueryBuilderAnswers>): QueuedResultShape => {
    const em = mockEntityManager()
    return { em, fakes: queueQueryBuilders(em, answers) }
}

/** The answers of an insert that wrote `rows`. */
export const inserted = (rows: ReadonlyArray<unknown>): QueryBuilderAnswers => ({ execute: { raw: rows } })
/** The answers of a read that found `row`. */
export const found = (row: unknown): QueryBuilderAnswers => ({ getRawOne: row })
/** The answers of a read that listed `rows`. */
export const listed = (rows: ReadonlyArray<unknown>): QueryBuilderAnswers => ({ getRawMany: rows })

/** What an insert query builder was told to write. */
export const writtenBy = (fake: FakeQueryBuilder | undefined): unknown => fake?.callsOf("values")[0]?.[0]

type OrderValuesResultShape = {
    workspaceId: string
    orderId: string | null
    leadId: string
    invoiceNo: string
    amountVnd: number
    dueAt: Date
    issuedBy: string
    issuedAt: Date
    status: string
}

/** What the clock-dated insert of an order invoice writes under a number. */
export const orderValues = (invoiceNo: string, orderId: string | null = "o1"): OrderValuesResultShape => ({
    workspaceId: WS,
    orderId,
    leadId: "l1",
    invoiceNo,
    amountVnd: 50_000,
    dueAt: new Date(DUE_AT),
    issuedBy: "Lan",
    issuedAt: new Date(NOW),
    status: "issued",
})

type RenewalValuesResultShape = {
    workspaceId: string
    contractId: string
    periodEndsOn: string
    leadId: string
    invoiceNo: string
    amountVnd: number
    dueAt: Date
    issuedBy: null
    issuedAt: Date
    status: string
}

/** What the clock-dated insert of a renewal invoice writes under a number. */
export const renewalValues = (invoiceNo: string, periodEndsOn: string = PERIOD): RenewalValuesResultShape => ({
    workspaceId: WS,
    contractId: CONTRACT,
    periodEndsOn,
    leadId: "l1",
    invoiceNo,
    amountVnd: 900_000,
    dueAt: new Date(DUE_AT),
    issuedBy: null,
    issuedAt: new Date(NOW),
    status: "issued",
})
