import type { DataRight } from "@nivo-lite/agent-sdk/rights"

/** The transactions of the workspace: the one to match, and whether another already paid an order. */
export const READ_TRANSACTIONS: DataRight = {
    kind: "bank-transaction",
    access: "read",
    scope: "workspace",
    fields: ["id", "amountVnd", "content", "counterpartName", "receivedAt", "orderId", "status"],
}

/** The orders of the workspace: the candidates a payment may settle. */
export const READ_ORDERS: DataRight = {
    kind: "order",
    access: "read",
    scope: "workspace",
    fields: ["id", "orderNo", "leadId", "items", "amountVnd", "status", "confirmedAt", "createdAt"],
}

/** What customers said about having paid. */
export const READ_CLAIMS: DataRight = {
    kind: "payment-claim",
    access: "read",
    scope: "workspace",
    fields: ["id", "leadId", "conversationId", "amountVnd", "names", "body", "claimedAt", "status"],
}

/** The customers' names, to compare with the name on a transfer. */
export const READ_LEADS: DataRight = {
    kind: "sales-lead",
    access: "read",
    scope: "workspace",
    fields: ["id", "contactName"],
}

/** The conversation a customer wrote in, to answer them where they wrote. */
export const READ_CONVERSATIONS: DataRight = {
    kind: "conversation",
    access: "read",
    scope: "workspace",
    fields: ["id", "leadId", "lastMessageAt"],
}
