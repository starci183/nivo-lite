import type { DecisionQueueView, DecisionRowView } from "../../views/views.types"
import type { TransactionRecord } from "./accounting.types"

/** The payment a decision row is about. */
export type UnmatchedPayment = Pick<TransactionRecord, "id" | "amountVnd" | "reference" | "payer" | "occurredAt">

const VND = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 })

const rowOf = (payment: UnmatchedPayment): DecisionRowView => ({
    id: payment.id,
    title: payment.payer ?? payment.reference ?? payment.id,
    description: payment.reference ?? "",
    badges: [],
    reason: null,
    amount: VND.format(Math.round(payment.amountVnd)),
    proposal: payment.reference ?? "",
    trace: null,
    expiry: null,
    primary: null,
    edit: null,
    menu: [],
    waitingFor: null,
})

/** The payments nobody tied to an invoice as a decision queue; `total` counts every such payment. */
export const unmatchedQueueOf = (payments: ReadonlyArray<UnmatchedPayment>, total: number): DecisionQueueView => ({
    count: total === 0 ? null : String(total),
    more: null,
    rows: payments.map(rowOf),
})
