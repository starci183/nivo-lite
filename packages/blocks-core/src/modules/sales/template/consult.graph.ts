import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    absent,
    and,
    callWorkflow,
    defineTemplateGraph,
    endRound,
    equals,
    handBack,
    ifNode,
    loop,
    memberContains,
    node,
    notEquals,
    or,
    outcome,
    present,
    ref,
    round,
    trigger,
    wait,
    waitFor,
    type TemplateCatalogue,
    type TemplateGraph,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID } from "../../../bounds"
import { salesConsultTurnNode } from "../../../nodes/sales/consult-turn.node"
import { salesCreditNoticeNode } from "../../../nodes/sales/credit-notice.node"
import { salesCreditReadNode } from "../../../nodes/sales/credit-read.node"
import { salesNotSaleNoticeNode } from "../../../nodes/sales/not-sale-notice.node"
import { salesOccasionKeepNode } from "../../../nodes/sales/occasion-keep.node"
import { salesOrderCreateNode } from "../../../nodes/sales/order-create.node"
import { salesOrderPaidNode } from "../../../nodes/sales/order-paid.node"
import { salesOrderTalkNode } from "../../../nodes/sales/order-talk.node"
import { salesOrderTellNode } from "../../../nodes/sales/order-tell.node"
import { salesPaymentRemindNode } from "../../../nodes/sales/payment-remind.node"
import { salesPaymentShortNode } from "../../../nodes/sales/payment-short.node"
import { salesRequestQrNode } from "../../../nodes/sales/request-qr.node"
import { salesUnpaidNoticeNode } from "../../../nodes/sales/unpaid-notice.node"
import { salesOrderCancelTellNode } from "../../../nodes/sales/order-cancel-tell.node"
import { salesCancelPaidNoticeNode } from "../../../nodes/sales/cancel-paid-notice.node"
import { salesOrderCancelNode } from "../../../nodes/sales/order-cancel.node"
import { salesOrderReadNode } from "../../../nodes/sales/order-read.node"
import { teamDeclinedNoticeNode } from "../../../nodes/team/declined-notice.node"
import { teamUnsentNoticeNode } from "../../../nodes/team/unsent-notice.node"
import { messageOf } from "../../../messages/catalog"

/**
 * The sale's contract: what the front desk hands on (owner's final rule 7: no `recentLines`): the person's route (the callee input keeps its
 * name `conversationId` until the end sweep, R19), the words that opened the sale, the channel, the person and where the visit's window on
 * the route's lines starts (`since`: the consult reads the engine's thread from then on, pictures included; null: the whole route). The
 * talk loop then takes every later message of the person through its own `wait`.
 */
const input = z.object({
    conversationId: z.string().min(1).max(MAX_ID),
    text: z.string().max(MAX_BODY),
    channel: z.string().min(1).max(MAX_ID).nullable().optional(),
    contactId: z.string().min(1).max(MAX_ID).nullable().optional(),
    since: z.string().max(MAX_ID).nullable().optional(),
})

const LOCALE = "vi"

/** The customer message verbs the sale's waits listen for: the person writes on any of the front desk's channels. */
const SAID = {
    zalo: waitFor(TRIGGER.zaloMessageReceived),
    telegram: waitFor(TRIGGER.telegramMessageReceived),
    facebook: waitFor(TRIGGER.facebookMessageReceived),
    instagram: waitFor(TRIGGER.instagramMessageReceived),
} as const

/** The rounds of the talk loop: one per customer message (R9: a body that parks at a wait may run 30). */
const TALK_ROUNDS = 30

/** The rounds of the payment loop: reminders and order talks, then `unpaid` (R9). */
const PAY_ROUNDS = 6

/** The consult's last word, read after the talk loop through its `last` (the consult that ended the final round). */
const CONSULT = {
    branch: ref("steps.talk.output.last.branch", { default: null }),
    contactId: ref("steps.talk.output.last.contactId", { default: null }),
} as const

/** A member of the draft the talk ended on: the loop`s `last` (the output of the round-ending step: the consult). */
const draftRef = (member: string) => ref(`steps.talk.output.last.${member}`, { default: null })

const CATALOGUE: TemplateCatalogue = {
    name: { vi: "Bán hàng", en: "Sale" },
    summary: {
        vi: "Một lượt chạy cho cả việc bán: tư vấn từng tin nhắn của khách, ghi đơn, gửi mã QR, chờ tiền về hoặc tin nhắn về đơn, nhắc khi quá hạn",
        en: "One run for the whole sale: consults on each of the customer's messages, records the order, sends the QR, waits for the money or a message about the order, reminds when it is late",
    },
    version: 29,
    publishedAt: "2026-11-14T14:00:00.000Z",
    notes: {
        vi: "Tư vấn đọc cuộc trò chuyện của hệ thống (cả hình khách gửi) từ lúc bắt đầu lượt ghé; câu trả lời về đơn không tới được khách thì báo đội; hết lượt nhắc mà đơn chưa trả thì báo đội mã đơn và tổng tiền",
        en: "The consult reads the engine's conversation (the customer's pictures included) from the visit's start; an answer about the order that did not reach the customer tells the team; an order still unpaid after every reminder tells the team its code and total",
    },
}

/**
 * `sales.consult` version 29 (a refused payment reminder tells the team: `remind-sent` -> `remind-unsent-notice`, R47; else as v28): THE SALE AS ONE RUN (owner's final rule 7; coordinator rulings R8, R9, R13, R32, R33, R41; ROAD-API). The key
 * stays `sales.consult` so the front desk's hand-off and the agent's primary keep their name.
 * - TALK LOOP (`talk`, until the consult settles, at most 30 rounds; R33): round 1 has no event, so it goes straight to `consult` with the
 *   hand-off's words; every later round first parks at `hear` for the person's next message (a day at most) and `consult` answers THAT
 *   message, going on from the draft the round before wrote (R13). ONE consult step; `asked` ends the round. Not about a sale (`off`, the
 *   model's judgement): a round that waited hands its message back (`give-back-talk`); in round 1 the team is told the route and the
 *   words inside the round (`not-sale-notice`, R41 Q10: never silent), the talk ends and the run ends `not-sale`. It ends when the consult says `ready`, `cancel` or `declined`, or when the person went quiet. Every later step reads the
 *   draft from the loop's `last` (the consult that ended the final round), however many rounds it took.
 * - ORDER: `create-order` -> `request-qr` -> `tell-order` (unchanged steps).
 * - PAYMENT LOOP (`pay`, until the order is recorded paid, at most 6 rounds, then `unpaid`): `await` parks for the bank credit whose transfer
 *   content holds the order's code (the format check today's money steps make, `memberContains` on the event's `data.content`) and that is
 *   money IN (`data.direction` = `in`, R32), or a message of the person, 24 h at most. A credit: read it, the exact total records the order
 *   paid, another total tells the customer the difference and the team (`short-notice`). A credit naming no waiting sale is the registered
 *   `sales.payment` graph's (its `credit-notice` tells the team).
 *   A message: `order-talk` (the model decides by meaning whether it is about the order: `about` answers it; `off` hands the event back,
 *   `give-back`, to the next run waiting for it and then to the graphs registered on it, and the round ends with nothing said). The timeout: the reminder (the separate `sales.payment-reminder` timer graph
 *   is gone). An answer about the order that did not reach the customer (refused, declined; not `route_held`) tells the team
 *   (`order-talk-unsent-notice`, R45) and the wait goes on. A person declining the paid record on its card ends the loop: the team is told
 *   which order (`paid-declined-notice`, R41 Q8) and the run ends `declined`. Paid: the after-sale is called, then `paid`. Out of rounds:
 *   the team is told the order and its total (`unpaid-notice`, R45), then `unpaid`. The talk loop running out ends `quiet` with no notice
 *   (a customer going quiet is normal).
 * Every customer-facing step reads the conversation right before it speaks through the read tools (R16); the consult reads the engine's
 * thread from the visit's start (`since`), the customer's pictures included.
 */
export const salesConsultGraph: TemplateGraph = defineTemplateGraph({
    key: "sales.consult",
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({ data: input }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "talk",
    nodes: {
        talk: loop({
            until: or(
                equals(ref("steps.consult.output.branch", { default: null }), "ready"),
                equals(ref("steps.consult.output.branch", { default: null }), "cancel"),
                equals(ref("steps.consult.output.branch", { default: null }), "declined"),
                equals(ref("steps.hear.output.trigger", { default: null }), "timeout"),
                // Round 1 (no wait ran yet) judged not about a sale: nothing to hand back, the run ends `not-sale`.
                and(equals(ref("steps.consult.output.branch", { default: null }), "off"), absent(ref("steps.hear.output.trigger", { default: null }))),
            ),
            max: TALK_ROUNDS,
            body: {
                start: "opening",
                nodes: {
                    // Round 1 has no event: its message is the hand-off's words. Every later round takes the person's next message first.
                    opening: ifNode({ when: equals(round(), 1), yes: "consult", no: "hear" }),
                    hear: wait({
                        for: SAID,
                        timeout: "1d",
                        next: { zalo: "consult", telegram: "consult", facebook: "consult", instagram: "consult", timeout: endRound },
                    }),
                    consult: node(salesConsultTurnNode, {
                        input: {
                            conversationId: ref("trigger.data.conversationId"),
                            text: ref("trigger.data.text"),
                            // THIS round's message (null in round 1: the hand-off's `text` is the message then).
                            latest: ref("steps.hear.output.event.data.text", { default: null }),
                            draft: ref("steps.consult.output", { round: "previous", default: null }),
                            channel: ref("trigger.data.channel", { default: null }),
                            contactId: ref("trigger.data.contactId", { default: null }),
                            since: ref("trigger.data.since", { default: null }),
                            locale: LOCALE,
                        },
                        routes: { asked: endRound, ready: endRound, cancel: endRound, declined: endRound, off: "off-round" },
                    }),
                    // Not about a sale (the model's judgement): a round that waited hands its message back; round 1 has no wait to hand it
                    // back to, so the team is told the route and the words on /chat (R41 Q10: never silent) and the talk ends.
                    "off-round": ifNode({ when: equals(round(), 1), yes: "not-sale-notice", no: "give-back-talk" }),
                    // Inside the round (v28): the round then ENDS on this node step, so the loop's `last` is the notice's own output
                    // (`posted`), whatever the engine records for an if-step (S5d measured `{ branch: "yes" }` from `off-round` on v27).
                    "not-sale-notice": node(salesNotSaleNoticeNode, {
                        input: { routeId: ref("trigger.data.conversationId"), text: ref("trigger.data.text"), locale: LOCALE },
                        next: endRound,
                    }),
                    "give-back-talk": handBack({ wait: "hear" }),
                },
            },
            next: "settled",
            exhausted: "quiet",
        }),
        // The occasions the customer mentioned on the way are kept first (a side step), whatever the talk came to.
        settled: ifNode({
            when: present(draftRef("occasions")),
            yes: "keep-occasions",
            no: "not-sale-said",
        }),
        // The talk stopped on round 1's "not about a sale": that round ended on `not-sale-notice` (the team was told), so the loop's `last`
        // is the notice's output, the only round-ending step that answers `posted` (a structural member, posted or not). A later round's
        // `off` hands its message back and the talk goes on.
        "not-sale-said": ifNode({
            when: present(ref("steps.talk.output.last.posted", { default: null })),
            yes: "not-sale",
            no: "ready-said",
        }),
        "not-sale": outcome({ name: "not-sale" }),
        "keep-occasions": node(salesOccasionKeepNode, {
            input: { contactId: CONSULT.contactId, occasions: draftRef("occasions") },
            next: "keep-occasions-declined",
        }),
        // Keeping the dates is a SIDE step: a person declining it is told to the team (DECLINED.md) and the sale goes on where the talk
        // left it (v27: it used to end the run `declined` silently, before the order of a `ready` talk was ever recorded).
        "keep-occasions-declined": ifNode({
            when: equals(ref("steps.keep-occasions.output.declined"), true),
            yes: "keep-occasions-declined-notice",
            no: "not-sale-said",
        }),
        "keep-occasions-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: messageOf("vi", "nodeSalesOccasionKeepTitle"), ref: null },
            next: "not-sale-said",
        }),
        "ready-said": ifNode({ when: equals(CONSULT.branch, "ready"), yes: "create-order", no: "cancel-said" }),
        "create-order": node(salesOrderCreateNode, {
            input: {
                contactId: CONSULT.contactId,
                items: draftRef("items"),
                address: draftRef("address"),
                recipientName: draftRef("recipientName"),
                recipientPhone: draftRef("recipientPhone"),
                deliveryAt: draftRef("deliveryAt"),
            },
            next: "create-declined",
        }),
        // A person declined recording the order: no order exists, the customer is left without its code. One team notice, then `declined`.
        "create-declined": ifNode({
            when: equals(ref("steps.create-order.output.declined"), true),
            yes: "create-declined-notice",
            no: "request-qr",
        }),
        "create-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: messageOf(LOCALE, "nodeSalesOrderCreateTitle"), ref: null, locale: LOCALE },
            next: "declined",
        }),
        "request-qr": node(salesRequestQrNode, {
            input: { orderNo: ref("steps.create-order.output.orderNo"), amountVnd: ref("steps.create-order.output.amountVnd") },
            next: "tell-order",
        }),
        "tell-order": node(salesOrderTellNode, {
            input: {
                conversationId: ref("trigger.data.conversationId"),
                orderNo: ref("steps.create-order.output.orderNo"),
                amountVnd: ref("steps.create-order.output.amountVnd"),
                lines: ref("steps.create-order.output.lines"),
                qr: ref("steps.request-qr.output"),
                locale: LOCALE,
            },
            next: "tell-declined",
        }),
        "tell-declined": ifNode({
            when: equals(ref("steps.tell-order.output.declined"), true),
            yes: "tell-declined-notice",
            no: "pay",
        }),
        "tell-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: messageOf(LOCALE, "nodeSalesOrderTellTitle"), ref: ref("steps.create-order.output.orderNo"), locale: LOCALE },
            next: "declined",
        }),
        pay: loop({
            // Paid, or a person declined recording it paid (R41 Q8: the loop does not go on silently after a decline).
            until: or(
                present(ref("steps.paid-order.output.orderNo", { default: null })),
                equals(ref("steps.paid-order.output.declined", { default: false }), true),
            ),
            max: PAY_ROUNDS,
            body: {
                start: "await",
                nodes: {
                    await: wait({
                        for: {
                            // Money IN only (R32): a feed carries both directions and only a registration is narrowed by the engine, so
                            // the wait states it as the old payment graph's registration had it; a debit naming the order is no payment.
                            credit: waitFor(TRIGGER.paymentCreditReceived, {
                                where: [{ param: "data.direction", op: "equals", value: "in" }],
                                match: [memberContains("data.content", ref("steps.create-order.output.orderNo"))],
                            }),
                            ...SAID,
                        },
                        timeout: "1d",
                        next: {
                            credit: "credit",
                            zalo: "order-talk",
                            telegram: "order-talk",
                            facebook: "order-talk",
                            instagram: "order-talk",
                            timeout: "remind",
                        },
                    }),
                    credit: node(salesCreditReadNode, {
                        input: { transactionId: ref("steps.await.output.event.data.transactionId") },
                        next: "exact",
                    }),
                    exact: ifNode({
                        when: equals(ref("steps.credit.output.amountVnd"), ref("steps.create-order.output.amountVnd")),
                        yes: "paid-order",
                        no: "short",
                    }),
                    "paid-order": node(salesOrderPaidNode, { input: { orderId: ref("steps.create-order.output.orderId") }, next: endRound }),
                    short: node(salesPaymentShortNode, {
                        input: {
                            contactId: CONSULT.contactId,
                            orderNo: ref("steps.create-order.output.orderNo"),
                            orderAmountVnd: ref("steps.create-order.output.amountVnd"),
                            creditAmountVnd: ref("steps.credit.output.amountVnd"),
                            locale: LOCALE,
                        },
                        next: "short-notice",
                    }),
                    // A credit the sale cannot settle by itself is never silent (R32): the team is told its amount and content too.
                    "short-notice": node(salesCreditNoticeNode, {
                        input: {
                            transactionId: ref("steps.credit.output.transactionId"),
                            amountVnd: ref("steps.credit.output.amountVnd"),
                            content: ref("steps.credit.output.content"),
                            locale: LOCALE,
                        },
                        next: endRound,
                    }),
                    "order-talk": node(salesOrderTalkNode, {
                        input: {
                            contactId: CONSULT.contactId,
                            text: ref("steps.await.output.event.data.text", { default: "" }),
                            orderNo: ref("steps.create-order.output.orderNo"),
                            amountVnd: ref("steps.create-order.output.amountVnd"),
                            locale: LOCALE,
                        },
                        // `off`: not about the order: the message goes back to whoever else waits for it (the front desk), the round ends.
                        routes: { about: "order-talk-sent", off: "give-back" },
                    }),
                    // An answer about the order that did not reach the customer (refused, or declined on its card) is never silent (R45):
                    // the team is told and the wait goes on. Under a staff hold (`route_held`) a person holds the thread: nothing to tell.
                    "order-talk-sent": ifNode({
                        // A refusal is there exactly when the answer was not delivered (order-talk's own output).
                        when: and(
                            present(ref("steps.order-talk.output.refusal", { default: null })),
                            notEquals(ref("steps.order-talk.output.refusal", { default: null }), "route_held"),
                        ),
                        yes: "order-talk-unsent-notice",
                        no: endRound,
                    }),
                    "order-talk-unsent-notice": node(teamUnsentNoticeNode, {
                        input: {
                            step: messageOf(LOCALE, "nodeSalesOrderTalkTitle"),
                            ref: ref("steps.create-order.output.orderNo"),
                            refusal: ref("steps.order-talk.output.refusal"),
                            locale: LOCALE,
                        },
                        next: endRound,
                    }),
                    "give-back": handBack({ wait: "await" }),
                    remind: node(salesPaymentRemindNode, {
                        input: {
                            contactId: CONSULT.contactId,
                            orderNo: ref("steps.create-order.output.orderNo"),
                            amountVnd: ref("steps.create-order.output.amountVnd"),
                            locale: LOCALE,
                        },
                        next: "remind-sent",
                    }),
                    // A reminder the channel refused (a closed window, an opted-out customer; v29) is never silent either: the team is told
                    // and the wait goes on. Under a staff hold (`route_held`) a person holds the thread: nothing to tell.
                    "remind-sent": ifNode({
                        when: and(
                            present(ref("steps.remind.output.refusal", { default: null })),
                            notEquals(ref("steps.remind.output.refusal", { default: null }), "route_held"),
                        ),
                        yes: "remind-unsent-notice",
                        no: endRound,
                    }),
                    "remind-unsent-notice": node(teamUnsentNoticeNode, {
                        input: {
                            step: messageOf(LOCALE, "nodeSalesPaymentRemindTitle"),
                            ref: ref("steps.create-order.output.orderNo"),
                            refusal: ref("steps.remind.output.refusal"),
                            locale: LOCALE,
                        },
                        next: endRound,
                    }),
                },
            },
            next: "paid-declined",
            exhausted: "unpaid-notice",
        }),
        // The payment wait ran out of rounds: the run ends `unpaid`, never silently (R45): the team is told the order and its total.
        "unpaid-notice": node(salesUnpaidNoticeNode, {
            input: {
                orderNo: ref("steps.create-order.output.orderNo"),
                amountVnd: ref("steps.create-order.output.amountVnd"),
                locale: LOCALE,
            },
            next: "unpaid",
        }),
        // A person declined recording the order paid on its card (R41 Q8, as `sales.payment`'s `pay-declined`): the order stays unpaid, the
        // team is told which order, the run ends `declined`.
        "paid-declined": ifNode({
            when: equals(ref("steps.pay.output.last.declined", { default: false }), true),
            yes: "paid-declined-notice",
            no: "to-after-sale",
        }),
        "paid-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: messageOf(LOCALE, "nodeSalesOrderPaidTitle"), ref: ref("steps.create-order.output.orderNo"), locale: LOCALE },
            next: "declined",
        }),
        "to-after-sale": callWorkflow({
            agent: "sales",
            workflow: "after-sale",
            version: "latest",
            input: { orderId: ref("steps.create-order.output.orderId"), contactId: CONSULT.contactId },
            next: "paid",
        }),
        paid: outcome({
            name: "paid",
            output: { contactId: ref("trigger.data.contactId", { default: null }), orderId: ref("steps.create-order.output.orderId"), orderNo: ref("steps.create-order.output.orderNo") },
        }),
        unpaid: outcome({
            name: "unpaid",
            output: { contactId: ref("trigger.data.contactId", { default: null }), orderId: ref("steps.create-order.output.orderId"), orderNo: ref("steps.create-order.output.orderNo") },
        }),
        "cancel-said": ifNode({ when: equals(CONSULT.branch, "cancel"), yes: "cancel-read", no: "declined-said" }),
        "declined-said": ifNode({ when: equals(CONSULT.branch, "declined"), yes: "consult-declined-notice", no: "quiet" }),
        // A person declined sending the customer's message: the customer is left unanswered. One team notice, then the outcome `declined`.
        "consult-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: messageOf(LOCALE, "nodeSalesConsultTurnTitle"), ref: null, locale: LOCALE },
            next: "declined",
        }),
        // The cancel branches on DATA: the order's status as its record keeps it. A paid order is not cancelled by the flow: the team is told.
        "cancel-read": node(salesOrderReadNode, { input: { orderId: draftRef("cancelOrderId") }, next: "cancel-paid" }),
        "cancel-paid": ifNode({ when: equals(ref("steps.cancel-read.output.status"), "paid"), yes: "cancel-paid-notice", no: "cancel-order" }),
        "cancel-paid-notice": node(salesCancelPaidNoticeNode, {
            input: { orderNo: ref("steps.cancel-read.output.orderNo"), reason: draftRef("cancelReason"), text: ref("trigger.data.text"), locale: LOCALE },
            next: "quiet",
        }),
        "cancel-order": node(salesOrderCancelNode, {
            input: { orderId: ref("steps.cancel-read.output.orderId"), reason: draftRef("cancelReason") },
            next: "cancel-declined",
        }),
        "cancel-declined": ifNode({
            when: equals(ref("steps.cancel-order.output.declined"), true),
            yes: "cancel-declined-notice",
            no: "tell-cancelled",
        }),
        "cancel-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: messageOf(LOCALE, "nodeSalesOrderCancelTitle"), ref: ref("steps.cancel-order.output.orderId"), locale: LOCALE },
            next: "declined",
        }),
        "tell-cancelled": node(salesOrderCancelTellNode, {
            input: {
                conversationId: ref("trigger.data.conversationId"),
                orderNo: ref("steps.cancel-order.output.orderNo", { default: null }),
                locale: LOCALE,
            },
            next: "tell-cancelled-declined",
        }),
        "tell-cancelled-declined": ifNode({
            when: equals(ref("steps.tell-cancelled.output.declined"), true),
            yes: "tell-cancelled-declined-notice",
            no: "quiet",
        }),
        "tell-cancelled-declined-notice": node(teamDeclinedNoticeNode, {
            input: {
                step: messageOf(LOCALE, "nodeSalesOrderCancelTellTitle"),
                ref: ref("steps.cancel-order.output.orderNo", { default: null }),
                locale: LOCALE,
            },
            next: "declined",
        }),
        declined: outcome({ name: "declined" }),
        // The person went quiet, or the talk ended with nothing to order: the run ends; a later message starts at the front desk again.
        quiet: outcome({ name: "quiet" }),
    },
})
