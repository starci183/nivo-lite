import type { NodeStore } from "@nivo-lite/agent-sdk/node"
import type { ClaimRow, LeadRow, OrderRow, TransactionRow } from "./payment.schemas"
import { sampleOf } from "../../messages/catalog"

/** SePay 95958515, 01:06 on 4 November 2026: +5000 from BUI NGUYEN DINH, with no order code in the content. */
export const TRANSACTION_DINH: TransactionRow = {
    id: "tx-95958515",
    amountVnd: 5000,
    reference: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
    payer: null,
    occurredAt: "2026-11-04T01:06:00.000Z",
    orderId: null,
    status: "unmatched",
}

/** The owner's own test: +2000 for an order of 1000, the content naming the order code. */
export const TRANSACTION_OVER: TransactionRow = {
    id: "tx-over",
    amountVnd: 2000,
    reference: "SO-0003 test",
    payer: null,
    occurredAt: "2026-11-04T02:10:00.000Z",
    orderId: null,
    status: "unmatched",
}

/** Dinh's order: one flower pot, 5,000, confirmed at 00:40 and waiting for money. */
export const ORDER_DINH: OrderRow = {
    id: "order-dinh",
    orderNo: "SO-0001",
    leadId: "lead-dinh",
    items: [{ name: "chau hoa", qty: 1 }],
    amountVnd: 5000,
    status: "confirmed",
    confirmedAt: "2026-11-04T00:40:00.000Z",
    createdAt: "2026-11-04T00:35:00.000Z",
}

/** The owner's test order of 1,000. */
export const ORDER_TEST: OrderRow = {
    id: "order-test",
    orderNo: "SO-0003",
    leadId: "lead-dinh",
    items: [{ name: "test", qty: 1 }],
    amountVnd: 1000,
    status: "confirmed",
    confirmedAt: "2026-11-04T02:00:00.000Z",
    createdAt: "2026-11-04T02:00:00.000Z",
}

/** The customer. */
export const LEAD_DINH: LeadRow = { id: "lead-dinh", contactName: sampleOf("sampleBuiNguyenDinh") }

/** His message of 00:54, twelve minutes before the money; the record stores the names as `{ values }`. */
export const CLAIM_DINH: ClaimRow = {
    id: "claim-dinh",
    leadId: "lead-dinh",
    conversationId: "conversation-dinh",
    amountVnd: 5000,
    names: { values: ["BUI NGUYEN DINH"] },
    body: sampleOf("sampleToiDaChuyenKhoan5kTen"),
    claimedAt: "2026-11-04T00:54:00.000Z",
    status: "open",
}

/** The real case: Dinh's money arrived, his order waits, his claim is open. */
export const STORE_REAL_CASE: NodeStore = {
    "bank-transaction": [TRANSACTION_DINH],
    order: [ORDER_DINH],
    "sales-lead": [LEAD_DINH],
    "payment-claim": [CLAIM_DINH],
}

/** Dinh said he paid, and no money has arrived yet. */
export const STORE_NOT_ARRIVED: NodeStore = { ...STORE_REAL_CASE, "bank-transaction": [], "payment-claim": [] }

/** The owner's 2,000-for-1,000 test. */
export const STORE_OVER: NodeStore = {
    ...STORE_REAL_CASE,
    "bank-transaction": [TRANSACTION_OVER],
    order: [ORDER_TEST],
    "payment-claim": [],
}
