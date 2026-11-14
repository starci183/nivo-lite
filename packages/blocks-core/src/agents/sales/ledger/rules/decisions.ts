import type { DecisionQueueView, DecisionRowView } from "../../../../shared/views/views.types"
import type { TransactionRecord } from "./accounting.types"

/** The payment a decision row is about. */
export type UnmatchedPayment = Pick<TransactionRecord, "id" | "amountVnd" | "reference" | "payer" | "occurredAt">

/** The command of a row that opens the picker of an order to assign the payment to. */
export const ASSIGN_COMMAND = "assign-order"

/** The command of a row that records the payment as other income. */
export const OTHER_INCOME_COMMAND = "other-income"

const VND = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 })

const rowOf = (payment: UnmatchedPayment): DecisionRowView => ({
    id: payment.id,
    title: payment.payer ?? payment.reference ?? payment.id,
    description: payment.reference ?? "",
    badges: [],
    reason: null,
    amount: VND.format(Math.round(payment.amountVnd)),
    amountValue: payment.amountVnd,
    proposal: payment.reference ?? "",
    trace: null,
    expiry: null,
    primary: { id: ASSIGN_COMMAND, label: ASSIGN_COMMAND, intent: "commit" },
    edit: null,
    menu: [{ id: OTHER_INCOME_COMMAND, label: OTHER_INCOME_COMMAND }],
    waitingFor: null,
})

/** The payments nobody tied to an invoice as a decision queue; `total` counts every such payment. */
export const unmatchedQueueOf = (payments: ReadonlyArray<UnmatchedPayment>, total: number): DecisionQueueView => ({
    count: total === 0 ? null : String(total),
    more: null,
    rows: payments.map((item) => rowOf(item)),
})
