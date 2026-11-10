import { builder } from "@starci/jest-preset"
import type { LeadFreeze, PendingEvent } from "@modules/domain/lead-freezes"

/** A customer who is not frozen yet: the record a first freeze creates. */
export const releasedFreezeOf: (overrides?: Partial<LeadFreeze>) => LeadFreeze = builder<LeadFreeze>({
    id: "freeze-1",
    version: "1",
    key: "lead:lead-1",
    leadId: "lead-1",
    conversationId: "c-1",
    status: "released",
    frozenRunId: null,
    agentId: null,
    frozenAt: null,
    frozenReason: null,
    stepKey: null,
    stepTitle: null,
    customerName: null,
    workItemId: null,
    episode: 0,
    failures: 0,
    heldBy: null,
    releasedAt: null,
    releasedBy: null,
    releaseReason: null,
    pending: [],
})

/** A lead frozen by the claim step of run-1, with its one owner item. */
export const frozenFreezeOf: (overrides?: Partial<LeadFreeze>) => LeadFreeze = builder<LeadFreeze>({
    ...releasedFreezeOf(),
    version: "3",
    status: "frozen",
    frozenRunId: "run-1",
    agentId: "chatbot",
    frozenAt: "2026-11-04T10:00:00.000Z",
    frozenReason: "GRAPH_NODES_EXECUTOR_MISSING",
    stepKey: "claim-ack",
    stepTitle: "Take a payment claim",
    customerName: "Nguyen Van A",
    workItemId: "item-1",
    episode: 1,
    failures: 1,
})

/** A line the frozen customer wrote in conversation c-1. */
export const pendingLineOf: (overrides?: Partial<PendingEvent>) => PendingEvent = builder<PendingEvent>({
    wakeId: "wake-2",
    agentId: "chatbot",
    source: "customer",
    eventKey: "msg-2",
    scopeKey: "conversation:c-1",
    context: { conversationId: "c-1", messageId: "m-2" },
    actorMemberId: null,
    kind: "message",
    at: "2026-11-04T10:01:00.000Z",
    conversationId: "c-1",
    messageIds: ["m-2"],
    folded: false,
})

/** A bank transaction that reached the frozen customer's Accounting agent. */
export const pendingPaymentOf: (overrides?: Partial<PendingEvent>) => PendingEvent = builder<PendingEvent>({
    ...pendingLineOf(),
    wakeId: "wake-3",
    agentId: "accounting",
    source: "tag",
    eventKey: "bank-feed:conn-1:e-1",
    scopeKey: "",
    context: { subject: "bank-transaction:tx-1", tagSource: "bank_feed" },
    kind: "payment",
    conversationId: null,
    messageIds: [],
})
