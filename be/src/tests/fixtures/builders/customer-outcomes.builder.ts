import type { CustomerTurn, ChatTurnProposal } from "@modules/domain/conversations"
import type { MessageCatalog } from "@modules/platform/i18n"
import { builder, mock } from "@starci/jest-preset"
import type { AuthorityRule, GraphAnswer } from "@modules/domain/authority-rules"
import type { BoundAgent } from "@modules/domain/agent-connections"
import type { WorkItem } from "@modules/domain/decisions"
import type { InvoiceRow } from "@modules/domain/invoices"
import { invoiceOf } from "./reconcile-payment-performer.builder"
import { ruleOf } from "./authority-rules.builder"
import { itemOf } from "./work-engine.builder"

export const WS = "11111111-1111-4111-8111-111111111111"
export const catalog: MessageCatalog = { get: (key: string) => key }

/** Complete owner-read rows with the customer workspace and the scenario's supplied fields. */
export const customerInvoiceOf = builder<InvoiceRow>({
    ...invoiceOf(),
    workspace_id: WS,
    lead_id: "l1",
    status: "issued",
    paid_at: null,
})
/** A reply rule whose mode is decided by the scenario. */
export const customerRuleOf = builder<AuthorityRule>({
    ...ruleOf(),
    department: "chatbot",
    action: "reply_customer",
    required_fields: [],
    limit_vnd: null,
})
/** The handling agent's ask-only connection binding. */
export const customerBindingOf = builder<BoundAgent>({
    id: "a1",
    module: "chatbot",
    name: "Bot",
    access: "ask",
    purpose: "inbound_chat",
})
/** A work row returned by a mocked collaborator, never persisted by these unit cases. */
export const customerWorkItemOf = builder<WorkItem>({
    ...itemOf(),
    workspace_id: WS,
    subject_type: "conversation",
    subject_id: "c1",
})

/** Unpaid, just-paid and old paid invoices used by the claim/reply cases. */
export const customerPaymentInvoices = {
    claimed: customerInvoiceOf({ id: "inv-1", invoice_no: "HD-01", lead_id: "l1", amount_vnd: 50_000 }),
    recent: customerInvoiceOf({
        id: "inv-2",
        invoice_no: "HD-02",
        status: "paid",
        paid_at: "2026-10-12T10:00:00.000Z",
    }),
    stale: customerInvoiceOf({ id: "inv-3", invoice_no: "HD-03", status: "paid", paid_at: "2020-01-01T00:00:00.000Z" }),
}

/** Exact visible outcomes of a released late reply and a module answer held by the published graph. */
export const CUSTOMER_OUTCOME_EXPECTED = {
    lateReply: { reply: "Drafted ORD-1", send: true, lines: [] },
    heldModuleReply: {
        reply: "Your appointment is requested",
        send: false,
        lines: ["customerTurns.replyAwaitsGraph", "customerTurns.graphUnread"],
    },
}

/** Captured replies and staff names at each durable decision state. */
export const replyDecisionCases = [
    ["done", false, undefined],
    ["waiting_decision", true, "Lan"],
    ["waiting_decision", false, ""],
] as const

/** A customer message turn with a configurable lead and agent knowledge for settlement cases. */
export const turnOf = (leadId: string | null = null, knowledge = "Tra sua: 50.000d"): CustomerTurn => ({
    conversation: {
        id: "c1",
        workspaceId: WS,
        channel: "telegram",
        externalId: "42",
        connectionId: null,
        leadId,
        handledBy: null,
        visitorName: "Lan",
        installationId: null,
        agent: {
            id: "a1",
            name: "Bot",
            handle: "bot",
            role: "Chatbot",
            module: "chatbot",
            instructions: "",
            knowledge,
            approvalRule: "",
            greeting: "",
        },
        speaksAs: null,
    },
    messageId: "m1",
    body: "I want one milk tea",
    channelEventId: "tg:42:1",
    transcript: [{ role: "user", body: "I want one milk tea" }],
})

/** A model proposal with settlement details and optional human-review overrides. */
export const proposalOf = (
    detail: Readonly<Record<string, unknown>>,
    changes: Partial<ChatTurnProposal> = {},
): ChatTurnProposal => ({
    reply: "Thanks!",
    needsHuman: false,
    reason: "",
    proposedAnswer: "",
    detail,
    ...changes,
})

/** The published reply branches, including an already-held item and the same diversion on both runtime roads. */
export const customerReplyGraphCases = () => {
    const ASK: GraphAnswer = { outcome: "ask", unread: ["outgoing.amount_vnd"], unjudged: "fact_unread", divert: null }
    const HAND = { action: "hand_over_conversation", handoverTo: "support", asks: false }
    const STOP: GraphAnswer = { outcome: "stop", unread: [], unjudged: null, divert: null }
    const DIVERT: GraphAnswer = { ...STOP, outcome: "divert", divert: HAND }
    return {
        ASK,
        found: { lines: [], changed: false, leadId: "l1", orderAmountVnd: 50_000 },
        order: proposalOf({ order: { items: "Tra sua", amount_vnd: 50_000 } }),
        askCases: [
            ["an earlier delivery already opened it", mock<WorkItem>({ id: "old" }), "waiting_decision"],
            ["it was decided at once", null, "done"],
        ] as const,
        stopCases: [
            ["stops it", STOP, "Stopped", false],
            ["leads elsewhere", DIVERT, "Diverted", false],
            ["leads elsewhere on the core road", DIVERT, "Diverted", true],
        ] as const,
    }
}

/** The exact booking proposal and parsed findings exercised by customer outcome settlement. */
export const bookingCase = {
    detail: {
        booking_request: {
            intent: "book",
            service: "Haircut",
            date: "2026-10-15",
            time: "9:00",
            party_size: 2,
            contact_name: "Lan",
            phone: "0900",
        },
        loyalty: { intent: "redeem", reward_key: "tea-voucher" },
    },
    findings: {
        reply: "Thanks!",
        needsHuman: false,
        reason: null,
        proposedAnswer: null,
        lead: null,
        order: null,
        paymentClaim: false,
        knowledgeGap: null,
        application: null,
        loyaltyRewardKey: "tea-voucher",
        bookingRequest: {
            intent: "book",
            service: "Haircut",
            date: "2026-10-15",
            time: "09:00",
            from: null,
            to: null,
            partySize: 2,
            name: "Lan",
            phone: "0900",
            email: null,
            note: null,
        },
    },
} as const

/** The r28 live probe on Sales: five small baskets, a model that set no order and claimed an approval no order waited for. */
export const r28SalesOrder = () => {
    const knowledge =
        "Gi\u00e1 tr\u1ecdn g\u00f3i: gi\u1ecf hoa nh\u1ecf 3.500.000 \u0111\u1ed3ng, gi\u1ecf hoa l\u1edbn 17.500.000 \u0111\u1ed3ng."
    const body =
        "Ch\u00e0o em, anh l\u00e0 Minh, s\u1ed1 0907654321. Anh \u0111\u1eb7t 5 gi\u1ecf uat-ae-20261103-62a985-gi\u1ecf-hoa-nh\u1ecf, t\u1ed5ng 17.500.000 \u0111\u1ed3ng, x\u00e1c nh\u1eadn \u0111\u01a1n gi\u00fap anh."
    const reply =
        "D\u1ea1 em ch\u00e0o anh Minh. Anh \u0111\u1eb7t 5 gi\u1ecf hoa nh\u1ecf, \u0111\u01a1n gi\u00e1 3.500.000 \u0111\u1ed3ng, t\u1ed5ng 17.500.000 \u0111\u1ed3ng \u1ea1. \u0110\u01a1n n\u00e0y tr\u00ean 5.000.000 \u0111\u1ed3ng n\u00ean em xin ph\u00e9p g\u1eedi ch\u1ee7 c\u1eeda h\u00e0ng duy\u1ec7t tr\u01b0\u1edbc, em s\u1ebd b\u00e1o anh ngay khi c\u00f3 k\u1ebft qu\u1ea3. Anh cho em xin \u0111\u1ecba ch\u1ec9 giao hoa v\u00e0 th\u1eddi gian nh\u1eadn nh\u00e9."
    const turn = { ...turnOf(null, knowledge), body }
    const kept =
        "D\u1ea1 em ch\u00e0o anh Minh. Anh \u0111\u1eb7t 5 gi\u1ecf hoa nh\u1ecf, \u0111\u01a1n gi\u00e1 3.500.000 \u0111\u1ed3ng, t\u1ed5ng 17.500.000 \u0111\u1ed3ng \u1ea1. Anh cho em xin \u0111\u1ecba ch\u1ec9 giao hoa v\u00e0 th\u1eddi gian nh\u1eadn nh\u00e9."
    const order = { items: "5 \u00d7 gi\u1ecf hoa nh\u1ecf", amountVnd: 17_500_000 }
    return { turn, proposal: proposalOf({ order: null }, { reply }), kept, order }
}
