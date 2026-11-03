import type { NodeStore } from "@nivo-lite/agent-sdk/node"
import { scoreCandidates } from "@nivo-lite/agent-sdk/reconcile"
import type { Arrival, Candidate, Claim, Evidenced } from "@nivo-lite/agent-sdk/reconcile"
import type { ClaimRow, ConversationRow, LeadRow, OrderRow, TransactionRow } from "./payment.schemas"

const HOUR_MS = 3_600_000

/** The window orders are looked at in, in hours. */
export const WINDOW_HOURS = 72
const OPTIONS = { windowMs: WINDOW_HOURS * HOUR_MS }

/** SePay 95958515, 01:06 on 4 November 2026: +5000 to 525209999 from BUI NGUYEN DINH, with no order code in the content. */
export const TRANSACTION_DINH: TransactionRow = {
    id: "tx-95958515",
    amountVnd: 5000,
    content: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
    counterpartName: null,
    receivedAt: "2026-11-04T01:06:00.000Z",
    orderId: null,
    status: "unmatched",
}

/** SePay 95937289, 22:51 the evening before: +2000 from MoMo, "Test Sepay". It belongs to no order. */
export const TRANSACTION_MOMO: TransactionRow = {
    id: "tx-95937289",
    amountVnd: 2000,
    content: "Test Sepay",
    counterpartName: null,
    receivedAt: "2026-11-03T22:51:00.000Z",
    orderId: null,
    status: "unmatched",
}

/** Định's order: one flower pot, 5,000, delivered to 69 Hàng Xanh, confirmed at 00:40 and waiting for money. */
export const ORDER_DINH: OrderRow = {
    id: "order-dinh",
    orderNo: "SO-0001",
    leadId: "lead-dinh",
    items: "1 chau hoa",
    amountVnd: 5000,
    status: "confirmed",
    confirmedAt: "2026-11-04T00:40:00.000Z",
    createdAt: "2026-11-04T00:35:00.000Z",
}

/** The customer. */
export const LEAD_DINH: LeadRow = { id: "lead-dinh", contactName: "Bùi Nguyên Định" }

/** His Zalo conversation. */
export const CONVERSATION_DINH: ConversationRow = {
    id: "conversation-dinh",
    leadId: "lead-dinh",
    lastMessageAt: "2026-11-04T00:54:00.000Z",
}

/** His message of 00:54, twelve minutes before the money. */
export const CLAIM_DINH: ClaimRow = {
    id: "claim-dinh",
    leadId: "lead-dinh",
    conversationId: "conversation-dinh",
    amountVnd: 5000,
    names: ["BUI NGUYEN DINH"],
    body: "Tôi đã chuyển khoản 5k, tên BUI NGUYEN DINH",
    claimedAt: "2026-11-04T00:54:00.000Z",
    status: "open",
}

/** The store the nodes read in the real case. */
export const STORE_REAL_CASE: NodeStore = {
    "bank-transaction": [TRANSACTION_DINH, TRANSACTION_MOMO],
    order: [ORDER_DINH],
    "sales-lead": [LEAD_DINH],
    conversation: [CONVERSATION_DINH],
    "payment-claim": [CLAIM_DINH],
}

/** The 5,000 transfer as an arrival. */
export const ARRIVAL_DINH: Arrival = {
    id: TRANSACTION_DINH.id,
    amount: 5000,
    text: TRANSACTION_DINH.content,
    names: [],
    at: Date.parse("2026-11-04T01:06:00.000Z"),
}

/** The 2,000 transfer as an arrival. */
export const ARRIVAL_MOMO: Arrival = {
    id: TRANSACTION_MOMO.id,
    amount: 2000,
    text: TRANSACTION_MOMO.content,
    names: [],
    at: Date.parse("2026-11-03T22:51:00.000Z"),
}

/** Định's order as a candidate. */
export const CANDIDATE_DINH: Candidate = {
    id: ORDER_DINH.id,
    label: "SO-0001 · Bùi Nguyên Định",
    amountDue: 5000,
    partyName: LEAD_DINH.contactName,
    partyKey: LEAD_DINH.id,
    codes: [ORDER_DINH.orderNo],
    openedAt: Date.parse("2026-11-04T00:40:00.000Z"),
}

/** His claim in the ledger's shape. */
export const CLAIM_OF_DINH: Claim = {
    id: CLAIM_DINH.id,
    partyKey: CLAIM_DINH.leadId,
    amount: 5000,
    names: CLAIM_DINH.names,
    text: CLAIM_DINH.body,
    at: Date.parse("2026-11-04T00:54:00.000Z"),
    status: "open",
}

/** The evidence for the 5,000 transfer: amount, name, claim and recency hold; no code. */
export const EVIDENCED_FOR_DINH: ReadonlyArray<Evidenced> = scoreCandidates(
    ARRIVAL_DINH,
    [CANDIDATE_DINH],
    [CLAIM_OF_DINH],
    OPTIONS,
)

/** The evidence for the 2,000 transfer: nothing holds. */
export const EVIDENCED_FOR_MOMO: ReadonlyArray<Evidenced> = scoreCandidates(
    ARRIVAL_MOMO,
    [CANDIDATE_DINH],
    [CLAIM_OF_DINH],
    OPTIONS,
)

/** The evidence for the 5,000 transfer when its content also names the order code (a re-run of the same case with a code). */
export const EVIDENCED_WITH_CODE: ReadonlyArray<Evidenced> = scoreCandidates(
    { ...ARRIVAL_DINH, text: `${ARRIVAL_DINH.text} SO-0001` },
    [CANDIDATE_DINH],
    [CLAIM_OF_DINH],
    OPTIONS,
)

/** The evidence for a transfer of 4,000 whose content names the order code: the code holds, the amount does not. */
export const EVIDENCED_CODE_WRONG_AMOUNT: ReadonlyArray<Evidenced> = scoreCandidates(
    { ...ARRIVAL_DINH, amount: 4000, text: `${ARRIVAL_DINH.text} SO-0001` },
    [CANDIDATE_DINH],
    [],
    OPTIONS,
)
