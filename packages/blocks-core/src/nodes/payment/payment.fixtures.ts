import type { NodeStore } from "@nivo-lite/agent-sdk/node"
import {
    scoreCandidates,
    type Arrival,
    type Candidate,
    type Claim,
    type Evidenced,
} from "@nivo-lite/agent-sdk/reconcile"
import type { ClaimRow, ConversationRow, LeadRow, OrderRow, TransactionRow } from "./payment.schemas"
import { sampleOf } from "../../messages/catalog"

const HOUR_MS = 3_600_000

/** The window orders are looked at in, in hours. */
export const WINDOW_HOURS = 72
const OPTIONS = { windowMs: WINDOW_HOURS * HOUR_MS }

/** SePay 95958515, 01:06 on 4 November 2026: +5000 to 525209999 from BUI NGUYEN DINH, with no order code in the content. */
export const TRANSACTION_DINH: TransactionRow = {
    id: "tx-95958515",
    amountVnd: 5000,
    reference: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
    payer: null,
    occurredAt: "2026-11-04T01:06:00.000Z",
    orderId: null,
    status: "unmatched",
}

/** SePay 95937289, 22:51 the evening before: +2000 from MoMo, "Test Sepay". It belongs to no order. */
export const TRANSACTION_MOMO: TransactionRow = {
    id: "tx-95937289",
    amountVnd: 2000,
    reference: "Test Sepay",
    payer: null,
    occurredAt: "2026-11-03T22:51:00.000Z",
    orderId: null,
    status: "unmatched",
}

/** Dinh's order: one flower pot, 5,000, delivered to 69 Hang Xanh, confirmed at 00:40 and waiting for money. */
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

/** The customer. */
export const LEAD_DINH: LeadRow = { id: "lead-dinh", contactName: sampleOf("sampleBuiNguyenDinh") }

/** His Zalo conversation. */
export const CONVERSATION_DINH: ConversationRow = {
    id: "conversation-dinh",
    leadId: "lead-dinh",
    lastAt: "2026-11-04T00:54:00.000Z",
}

/** An older conversation of the same customer, with no message in it. */
export const CONVERSATION_OLD: ConversationRow = { id: "conversation-old", leadId: "lead-dinh", lastAt: null }

/** A second order, invoiced and never confirmed, of a customer with no lead row, waiting for 7,000. */
export const ORDER_SECOND: OrderRow = {
    id: "order-2",
    orderNo: "SO-0002",
    leadId: "lead-gone",
    items: [],
    amountVnd: 7000,
    status: "invoiced",
    confirmedAt: null,
    createdAt: "2026-11-04T00:50:00.000Z",
}

/** A 7,000 transfer at 01:30 from a named payer, with no code. */
export const TRANSACTION_NAMED: TransactionRow = {
    id: "tx-named",
    amountVnd: 7000,
    reference: "thanh toan",
    payer: "Nguyen Van A",
    occurredAt: "2026-11-04T01:30:00.000Z",
    orderId: null,
    status: "unmatched",
}

/** A transfer that already paid another order. */
export const TRANSACTION_LINKED: TransactionRow = {
    ...TRANSACTION_DINH,
    id: "tx-linked",
    orderId: "order-other",
    status: "matched",
}

/** His message of 00:54, twelve minutes before the money. */
export const CLAIM_DINH: ClaimRow = {
    id: "claim-dinh",
    leadId: "lead-dinh",
    conversationId: "conversation-dinh",
    amountVnd: 5000,
    names: ["BUI NGUYEN DINH"],
    body: sampleOf("sampleToiDaChuyenKhoan5kTen"),
    claimedAt: "2026-11-04T00:54:00.000Z",
    status: "open",
}

/** The owner's claim of 2,000 with a MoMo receipt image, four minutes after transaction 95937289: no order is for 2,000. */
export const CLAIM_MOMO: ClaimRow = {
    id: "claim-momo",
    leadId: "lead-dinh",
    conversationId: "conversation-dinh",
    amountVnd: 2000,
    names: [],
    body: sampleOf("sampleAnhBienLaiMoMoEmDaChuyen"),
    claimedAt: "2026-11-03T22:55:00.000Z",
    status: "open",
}

/** The store the nodes read in the real case. */
export const STORE_REAL_CASE: NodeStore = {
    "bank-transaction": [TRANSACTION_DINH, TRANSACTION_MOMO],
    order: [ORDER_DINH],
    "sales-lead": [LEAD_DINH],
    conversation: [CONVERSATION_OLD, CONVERSATION_DINH],
    "payment-claim": [CLAIM_DINH],
}

/** The real case with the owner's MoMo claim as the only open claim. */
export const STORE_MOMO_CLAIM: NodeStore = { ...STORE_REAL_CASE, "payment-claim": [CLAIM_MOMO] }

/** The real case plus a second open order, a named 7,000 transfer and a transfer that already paid another order. */
export const STORE_EXTENDED: NodeStore = {
    ...STORE_REAL_CASE,
    "bank-transaction": [TRANSACTION_DINH, TRANSACTION_NAMED, TRANSACTION_LINKED],
    order: [ORDER_DINH, ORDER_SECOND],
}

/** The 5,000 transfer as an arrival. */
export const ARRIVAL_DINH: Arrival = {
    id: TRANSACTION_DINH.id,
    amount: 5000,
    text: TRANSACTION_DINH.reference,
    names: [],
    at: Date.parse("2026-11-04T01:06:00.000Z"),
}

/** The 7,000 transfer as an arrival. */
export const ARRIVAL_NAMED: Arrival = {
    id: TRANSACTION_NAMED.id,
    amount: 7000,
    text: TRANSACTION_NAMED.reference,
    names: ["Nguyen Van A"],
    at: Date.parse("2026-11-04T01:30:00.000Z"),
}

/** The 2,000 transfer as an arrival. */
export const ARRIVAL_MOMO: Arrival = {
    id: TRANSACTION_MOMO.id,
    amount: 2000,
    text: TRANSACTION_MOMO.reference,
    names: [],
    at: Date.parse("2026-11-03T22:51:00.000Z"),
}

/** Dinh's order as a candidate. */
export const CANDIDATE_DINH: Candidate = {
    id: ORDER_DINH.id,
    label: sampleOf("sampleSo0001BuiNguyenDinh"),
    amountDue: 5000,
    partyName: LEAD_DINH.contactName,
    partyKey: LEAD_DINH.id,
    codes: [ORDER_DINH.orderNo],
    openedAt: Date.parse("2026-11-04T00:40:00.000Z"),
}

/** The second order as a candidate: its customer has no name, and it opened when it was created. */
export const CANDIDATE_SECOND: Candidate = {
    id: ORDER_SECOND.id,
    label: "SO-0002 · —",
    amountDue: 7000,
    partyName: null,
    partyKey: "lead-gone",
    codes: ["SO-0002"],
    openedAt: Date.parse("2026-11-04T00:50:00.000Z"),
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

/** The evidence for the 7,000 transfer from a named payer: only the amount of the second order holds. */
export const EVIDENCED_FOR_NAMED: ReadonlyArray<Evidenced> = scoreCandidates(
    ARRIVAL_NAMED,
    [CANDIDATE_DINH, CANDIDATE_SECOND],
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

/** The MoMo claim in the ledger's shape. */
export const CLAIM_OF_MOMO: Claim = {
    id: CLAIM_MOMO.id,
    partyKey: "lead-dinh",
    amount: 2000,
    names: [],
    text: CLAIM_MOMO.body,
    at: Date.parse("2026-11-03T22:55:00.000Z"),
    status: "open",
}

/** The evidence for the 2,000 transfer when the owner's claim speaks for it: the claim holds for the order of the sample customer, the amount does not. */
export const EVIDENCED_FOR_MOMO_CLAIM: ReadonlyArray<Evidenced> = scoreCandidates(
    ARRIVAL_MOMO,
    [CANDIDATE_DINH],
    [CLAIM_OF_MOMO],
    OPTIONS,
)
