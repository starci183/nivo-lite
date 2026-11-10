import { TOOL } from "@nivo-lite/blocks-core"
import type { FlowModelScript } from "./flow-f-world.builder"
import {
    CONSULT_PURPOSE,
    CREATE_ORDER_PURPOSE,
    ORDER_NOTICE_PURPOSE,
    SEND_QR_PURPOSE,
    consultReady,
    createsOrder,
    noticesOrder,
    sendsQr,
} from "./sales-flow-cases.builder"
import words from "./demo-flow-shop.words.json"

/** The customer conversation of the demo. */
export const CONVERSATION = "conv-1"
/** The number of the first order the shop records. */
export const ORDER_NO = "DH-20261109-0001"

/** The purposes the agents of the front desk, of the reconcile chain and of the after-sale ask the model under (`<node id>:<purpose>`). */
export const UNDERSTAND_PURPOSE = "chatbot.understand:understand"
export const ANSWER_PURPOSE = "chatbot.answer:answer"
export const MATCH_PURPOSE = "accounting.match-payment:agent"
export const SETTLE_PURPOSE = "payment.settle:agent"
export const LEDGER_PURPOSE = "accounting.post-payment:agent"
export const RECEIVED_PURPOSE = "payment.received-notice:agent"
export const AFTER_SALE_PURPOSE = "sales.after-sale:after-sale"

/** The front desk's reading of a customer's line: what they want, one of the four routes of the front desk. */
export const understands = (branch: "buy" | "paid" | "complaint" | "question"): FlowModelScript => ({
    [UNDERSTAND_PURPOSE]: [{ answer: { branch, summary: `${words.customerName}: ${branch}` } }],
})

/** The front desk's agent answering a question: one send to the customer, then the words it sent. */
export const answers = (text: string): FlowModelScript => ({
    [ANSWER_PURPOSE]: [
        { call: { tool: TOOL.customerMessageSend, args: { conversationId: CONVERSATION, text } } },
        { done: { reply: text } },
    ],
})

/** The agent of the match step naming the transaction that pays an order, by the two ids. */
export const matches = (transactionId: string, orderId: string): FlowModelScript => ({
    [MATCH_PURPOSE]: [{ done: { transactionId, orderId, claimId: null, settle: true, reason: words.matchReason } }],
})

/** The agents of a bank credit that pays an order: the match, the order marked paid, the ledger entry and the team's card. */
export const paysOrder = (transactionId: string, orderId: string): FlowModelScript => ({
    ...matches(transactionId, orderId),
    [SETTLE_PURPOSE]: [
        { call: { tool: TOOL.paymentMarkPaid, args: { orderId, transactionId } } },
        { done: { result: "paid" } },
    ],
    [LEDGER_PURPOSE]: [{ call: { tool: TOOL.ledgerAppend, args: { transactionId } } }, { done: { ref: "Ledger!A2:G2" } }],
    [RECEIVED_PURPOSE]: [
        { call: { tool: TOOL.teamMessagePost, args: { kind: "payment.received", orderId } } },
        { done: { posted: true } },
    ],
})

/** The agent of the after-sale thank-you: one care message to the customer, the lead moved to after-sale. */
export const thanks = (orderId: string, text: string): FlowModelScript => ({
    [AFTER_SALE_PURPOSE]: [
        { call: { tool: TOOL.customerMessageSend, args: { leadId: "lead-1", text } } },
        { call: { tool: TOOL.leadUpdate, args: { leadId: "lead-1", consultStage: "after_sale" } } },
        { done: { orderId, sent: true, asked: null } },
    ],
})

/** What a step's agent answers when it cannot go on: its reason and the one thing it asks the founder. */
export const confusedBy = (reason: string, question: string | null = null): Readonly<Record<string, unknown>> => ({
    confused: { reason, question },
})

/**
 * The models of a Sales turn in which the customer settles the first bouquet and the address: the consult answers `ready`, the order is
 * recorded and confirmed (the shop's order tool answers `orderId`, numbered `orderNo`), its QR is sent and the team is told.
 */
export const agrees = (orderId: string = "order-1", orderNo: string = ORDER_NO): FlowModelScript => {
    const items = [{ catalogueItemId: "c1", quantity: 1 }]
    const address = words.addressFact
    const draft = { leadId: "lead-1", conversationId: CONVERSATION, channel: "zalo", items, address }
    return {
        [CONSULT_PURPOSE]: [...consultReady(draft)],
        [CREATE_ORDER_PURPOSE]: [...createsOrder({ leadId: "lead-1", items, address, orderId, orderNo })],
        [SEND_QR_PURPOSE]: [...sendsQr(orderId)],
        [ORDER_NOTICE_PURPOSE]: [...noticesOrder(orderId)],
    }
}
