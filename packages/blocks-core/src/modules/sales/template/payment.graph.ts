import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    callWorkflow,
    contains,
    defineTemplateGraph,
    endItem,
    equals,
    ifNode,
    item,
    loop,
    node,
    outcome,
    present,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID } from "../../../bounds"
import { messageOf } from "../../../messages/catalog"
import { salesAwaitingOrdersNode } from "../../../nodes/sales/awaiting-orders.node"
import { salesCreditNoticeNode } from "../../../nodes/sales/credit-notice.node"
import { BANK_FEED_PROVIDERS, salesCreditReadNode } from "../../../nodes/sales/credit-read.node"
import { salesCreditTallyNode } from "../../../nodes/sales/credit-tally.node"
import { salesOrderPaidNode } from "../../../nodes/sales/order-paid.node"
import { salesPaidClaimNoticeNode } from "../../../nodes/sales/paid-claim-notice.node"
import { salesPaidClaimReplyNode } from "../../../nodes/sales/paid-claim-reply.node"
import { salesPaymentShortNode } from "../../../nodes/sales/payment-short.node"
import { teamDeclinedNoticeNode } from "../../../nodes/team/declined-notice.node"

/** The language the payment graph writes in, as today's templates fix it. */
const LOCALE = "vi"

/**
 * The graph's contract: the bank row a credit names (the credit trigger), or the conversation of a customer who says they paid (a call
 * from the front desk). Each trigger supplies its own members; none is required of both.
 */
const input = z.object({
    // The event's data (the one pipeline's trigger scope): the credit's bank row, or the params of the front desk's call.
    data: z
        .object({
            transactionId: z.string().min(1).max(MAX_ID).optional(),
            conversationId: z.string().min(1).max(MAX_ID).optional(),
            text: z.string().max(MAX_BODY).optional(),
            contactId: z.string().min(1).max(MAX_ID).nullish(),
        })
        .optional(),
})

/** What the template catalogue shows of `sales.payment`: its name, summary, the one current version and what it changed. */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "Ti\u1ec1n v\u1ec1", en: "Money in" },
    summary: {
        vi: "Khi ng\u00e2n h\u00e0ng b\u00e1o c\u00f3 ti\u1ec1n v\u00e0o: n\u1ed9i dung ch\u1ee9a m\u00e3 \u0111\u01a1n v\u00e0 \u0111\u00fang t\u1ed5ng ti\u1ec1n th\u00ec ghi \u0111\u01a1n \u0111\u00e3 tr\u1ea3 v\u00e0 c\u1ea3m \u01a1n kh\u00e1ch; l\u1ec7ch ti\u1ec1n th\u00ec h\u1ecfi kh\u00e1ch; kh\u00f4ng kh\u1edbp th\u00ec b\u00e1o \u0111\u1ed9i",
        en: "When the bank reports money in: content holding the order code and the exact total records the order paid and thanks the customer; another amount asks the customer; no match tells the team",
    },
    version: 10,
    publishedAt: "2026-11-14T14:00:00.000Z",
    notes: {
        vi: "Lễ tân không còn chuyển kèm các dòng gần đây (không bước nào đọc)",
        en: "The front desk no longer hands on the recent lines (no step read them)",
    },
    // Seeded ACTIVE: a seed or re-seed adds it to the agent active, so the bank's credit reaches it.
    seedActive: true,
}

/** The credit as `credit` read it. */
const CREDIT = {
    transactionId: ref("steps.credit.output.transactionId"),
    amountVnd: ref("steps.credit.output.amountVnd"),
    content: ref("steps.credit.output.content"),
} as const

/**
 * `sales.payment` (Tien ve; the version is the catalogue's): the money side of the Zalo sale, a COMPOSITION; the engine holds no money logic.
 * - Woken by a bank credit (`nivo.trigger.payment.credit.received` on the agent's SePay, Casso or payOS feed): `credit` reads the ONE
 *   movement exactly (`nivo.tool.payment.credit.get` by the row id, one shape for the three), `awaiting` lists the orders that wait for
 *   their money (records), and `match` compares the credit with each in the graph's own expressions: its content CONTAINS the order's code (`named`) AND its amount
 *   EQUALS the order's total (`exact`) -> `pay` records the order paid; the code with another amount -> `short`, the agent asks the
 *   customer. `tally` hands on the order paid: one -> the after-sale (`to-after-sale`: the thank-you and the care), the run ends `paid`;
 *   none -> `credit-notice` tells the team on /chat (the edge for a person), the run ends `told`.
 * - Called by the front desk when a customer says they paid: `claim-reply` answers the customer without confirming anything,
 *   `claim-notice` tells the team the words and the customer's orders that still wait for their money, the run ends `claimed`; the money
 *   settles when the bank's credit arrives.
 * - `pay` declined (carried out of the match loop by `tally`: its `declined` is true when no order was paid) and `claim-reply` declined ->
 *   a team notice, then outcome `declined` (a person declining a write on its card is a business outcome; a customer left unanswered or a
 *   credit left unrecorded is told to the team).
 */
export const salesPaymentGraph: TemplateGraph = defineTemplateGraph({
    key: "sales.payment",
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input,
    // The verb is a CREDIT: the engine narrows a feed's movements to money in itself (`direction = in`, trigger-specs `CREDITS_ONLY`), so
    // no condition is written here and the graph never sees a debit from the bank feeds.
    triggers: [trigger(TRIGGER.paymentCreditReceived, { accounts: [...BANK_FEED_PROVIDERS] }), trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "source",
    nodes: {
        source: ifNode({
            when: present(ref("trigger.data.transactionId", { default: null })),
            yes: "credit",
            no: "claim-reply",
        }),

        // The bank's credit.
        credit: node(salesCreditReadNode, {
            input: { transactionId: ref("trigger.data.transactionId") },
            next: "awaiting",
        }),
        awaiting: node(salesAwaitingOrdersNode, { next: "match" }),
        match: loop({
            over: ref("steps.awaiting.output.orders"),
            key: "orderId",
            concurrency: 1,
            body: {
                start: "named",
                collect: "pay",
                nodes: {
                    named: ifNode({ when: contains(CREDIT.content, item("orderNo")), yes: "exact", no: endItem }),
                    exact: ifNode({ when: equals(CREDIT.amountVnd, item("amountVnd")), yes: "pay", no: "short" }),
                    pay: node(salesOrderPaidNode, { input: { orderId: item("orderId") }, next: endItem }),
                    short: node(salesPaymentShortNode, {
                        input: {
                            contactId: item("contactId", { default: null }),
                            orderNo: item("orderNo"),
                            orderAmountVnd: item("amountVnd", { default: null }),
                            creditAmountVnd: CREDIT.amountVnd,
                            locale: LOCALE,
                        },
                        next: endItem,
                    }),
                },
            },
            next: "tally",
        }),
        tally: node(salesCreditTallyNode, { input: { items: ref("steps.match.output.items") }, next: "paid-said" }),
        "paid-said": ifNode({
            when: present(ref("steps.tally.output.orderId", { default: null })),
            yes: "to-after-sale",
            no: "pay-declined",
        }),
        // The credit matched an order exactly but a person declined recording it paid: the loop's items are independent, `tally` carries the
        // decline out (true only when no order was paid). One team notice, then the outcome `declined`; the order stays unpaid.
        "pay-declined": ifNode({
            when: equals(ref("steps.tally.output.declined"), true),
            yes: "pay-declined-notice",
            no: "credit-notice",
        }),
        "pay-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: messageOf(LOCALE, "nodeSalesOrderPaidTitle"), ref: null, locale: LOCALE },
            next: "declined",
        }),
        "to-after-sale": callWorkflow({
            agent: "sales",
            workflow: "after-sale",
            version: "latest",
            input: { orderId: ref("steps.tally.output.orderId"), contactId: ref("steps.tally.output.contactId", { default: null }) },
            next: "paid",
        }),
        paid: outcome({
            name: "paid",
            output: { orderId: ref("steps.tally.output.orderId"), transactionId: CREDIT.transactionId },
        }),
        "credit-notice": node(salesCreditNoticeNode, {
            input: {
                transactionId: CREDIT.transactionId,
                amountVnd: CREDIT.amountVnd,
                content: CREDIT.content,
                locale: LOCALE,
            },
            next: "told",
        }),
        told: outcome({
            name: "told",
            output: { transactionId: CREDIT.transactionId, amountVnd: CREDIT.amountVnd },
        }),

        // A customer who says they paid.
        "claim-reply": node(salesPaidClaimReplyNode, {
            input: {
                conversationId: ref("trigger.data.conversationId", { default: null }),
                text: ref("trigger.data.text", { default: null }),
                locale: LOCALE,
            },
            next: "claim-reply-declined",
        }),
        // The customer who says they paid is left unanswered when a person declines the reply: the team is told, the run ends `declined`.
        "claim-reply-declined": ifNode({
            when: equals(ref("steps.claim-reply.output.declined"), true),
            yes: "claim-reply-declined-notice",
            no: "claim-notice",
        }),
        "claim-reply-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: messageOf(LOCALE, "nodeSalesPaidClaimReplyTitle"), ref: null, locale: LOCALE },
            next: "declined",
        }),
        "claim-notice": node(salesPaidClaimNoticeNode, {
            input: {
                contactId: ref("trigger.data.contactId", { default: null }),
                text: ref("trigger.data.text", { default: null }),
                locale: LOCALE,
            },
            next: "claimed",
        }),
        claimed: outcome({ name: "claimed", output: { awaiting: ref("steps.claim-notice.output.awaiting") } }),
        declined: outcome({ name: "declined" }),
    },
})
