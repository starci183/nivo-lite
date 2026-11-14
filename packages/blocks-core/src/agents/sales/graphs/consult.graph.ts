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
    or,
    outcome,
    present,
    ref,
    round,
    trigger,
    wait,
    waitFor,
    type NoticeFact,
    type TemplateCatalogue,
    type TemplateGraph,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID } from "../../../shared/bounds"
import { salesConsultTurnNode } from "../nodes/consult-turn.node"
import { salesCreditNoticeNode } from "../nodes/credit-notice.node"
import { salesCreditReadNode } from "../nodes/credit-read.node"
import { salesNotSaleNoticeNode } from "../nodes/not-sale-notice.node"
import { salesOccasionKeepNode } from "../nodes/occasion-keep.node"
import { salesOrderCreateNode } from "../nodes/order-create.node"
import { salesOrderPaidNode } from "../nodes/order-paid.node"
import { salesOrderTalkNode } from "../nodes/order-talk.node"
import { salesOrderTellNode } from "../nodes/order-tell.node"
import { salesPaymentRemindNode } from "../nodes/payment-remind.node"
import { salesPaymentShortNode } from "../nodes/payment-short.node"
import { salesRequestQrNode } from "../nodes/request-qr.node"
import { salesOrderCancelTellNode } from "../nodes/order-cancel-tell.node"
import { salesCancelPaidNoticeNode } from "../nodes/cancel-paid-notice.node"
import { salesOrderCancelNode } from "../nodes/order-cancel.node"
import { salesOrderReadNode } from "../nodes/order-read.node"

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

/** The label of the order's code in a team notice the engine posts for a step of the order (R68). */
const ORDER_LABEL = { vi: "Mã đơn", en: "Order" } as const

/** The order's code and total, as the engine's team notices of the order's steps name them (R68). */
const ORDER: NoticeFact = { label: ORDER_LABEL, value: ref("steps.create-order.output.orderNo") }
const TOTAL: NoticeFact = { label: { vi: "Tổng tiền", en: "Total" }, value: ref("steps.create-order.output.amountVnd") }

/** A step a person declined on its card: the engine tells the team, then the run ends `declined` (R68). */
const DECLINED_ENDS = { then: "end", outcome: "declined" } as const

const CATALOGUE: TemplateCatalogue = {
    name: { vi: "Bán hàng", en: "Sale" },
    summary: {
        vi: "Một lượt chạy cho cả việc bán: tư vấn từng tin nhắn của khách, ghi đơn, gửi mã QR, chờ tiền về hoặc tin nhắn về đơn, nhắc khi quá hạn",
        en: "One run for the whole sale: consults on each of the customer's messages, records the order, sends the QR, waits for the money or a message about the order, reminds when it is late",
    },
    version: 30,
    publishedAt: "2026-11-14T18:00:00.000Z",
    notes: {
        vi: "Quy trình chỉ còn các bước bán hàng: bước bị từ chối hoặc không tới được khách thì hệ thống tự báo đội (kèm mã đơn, tổng tiền) rồi đi tiếp hoặc kết thúc như trước; hết lượt nhắc mà đơn chưa trả thì hệ thống báo đội",
        en: "The workflow keeps only the sale's steps: a step declined or not delivered to the customer is told to the team by the engine (with the order's code and total), then the run goes on or ends as before; an order still unpaid after every reminder is told to the team by the engine",
    },
}

/**
 * `sales.consult` version 30 (R68: pure business; every "was it declined / not delivered -> team notice" pair is gone: the step declares
 * its `unsuccessful` ending and the ENGINE tells the team, then goes on or ends `declined`): THE SALE AS ONE RUN (owner's final rule 7;
 * coordinator rulings R8, R9, R13, R32, R33, R41, R45, R47, R68). The key stays `sales.consult` so the front desk's hand-off and the
 * agent's primary keep their name.
 * - TALK LOOP (`talk`, until the consult settles, at most 30 rounds; R33): round 1 has no event, so it goes straight to `consult` with the
 *   hand-off's words; every later round first parks at `hear` for the person's next message (a day at most) and `consult` answers THAT
 *   message, going on from the draft the round before wrote (R13). ONE consult step; `asked` ends the round. Not about a sale (`off`, the
 *   model's judgement): a round that waited hands its message back (`give-back-talk`); in round 1 the team is told the route and the
 *   words inside the round (`not-sale-notice`, R41 Q10: a notice with its own business content), the talk ends and the run ends
 *   `not-sale`. It ends when the consult says `ready` or `cancel`, or when the person went quiet. A person declining the consult's answer
 *   on its card: the engine tells the team and the run ends `declined`. Every later step reads the draft from the loop's `last`.
 * - The dates the customer mentioned are kept (`keep-occasions`, a side step: with none the node keeps nothing; declined: the engine tells
 *   the team and the sale goes on).
 * - ORDER: `create-order` -> `request-qr` -> `tell-order` (declined: the engine tells the team, the run ends `declined`).
 * - PAYMENT LOOP (`pay`, until the order is recorded paid, at most 6 rounds, then `unpaid`): `await` parks for the bank credit whose transfer
 *   content holds the order's code (`memberContains` on the event's `data.content`) and that is money IN (`data.direction` = `in`, R32),
 *   or a message of the person, 24 h at most. A credit: read it, the exact total records the order paid, another total tells the customer
 *   the difference and the team (`short-notice`, R32 money facts). A credit naming no waiting sale is the registered `sales.payment`
 *   graph's. A message: `order-talk` (the model decides by meaning whether it is about the order: `about` answers it; `off` hands the
 *   event back, `give-back`). The timeout: the reminder. An answer or a reminder that did not reach the customer (refused or declined; not
 *   `route_held`): the engine tells the team and the wait goes on. A person declining the paid record: the engine tells the team which
 *   order and the run ends `declined`. Paid: the after-sale is called, then `paid`. Out of rounds: the engine tells the team the order and
 *   its total, then `unpaid`. The talk loop running out ends `quiet` with no notice (a customer going quiet is normal).
 * - CANCEL: the order's status as its record keeps it; a paid order is not cancelled by the flow (`cancel-paid-notice` tells the team the
 *   order, the reason and the words); else `cancel-order` -> `tell-cancelled` (declined: the engine tells the team, `declined`).
 * Every customer-facing step reads the conversation right before it speaks through the read tools (R16).
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
            label: { vi: "Tư vấn", en: "Consult" },
            until: or(
                equals(ref("steps.consult.output.branch", { default: null }), "ready"),
                equals(ref("steps.consult.output.branch", { default: null }), "cancel"),
                equals(ref("steps.hear.output.trigger", { default: null }), "timeout"),
                // Round 1 (no wait ran yet) judged not about a sale: nothing to hand back, the run ends `not-sale`.
                and(equals(ref("steps.consult.output.branch", { default: null }), "off"), absent(ref("steps.hear.output.trigger", { default: null }))),
            ),
            exits: {
                until: { vi: "Thoát khi khách chốt, hủy, im lặng hoặc không phải mua hàng", en: "Leaves when the customer orders, cancels, goes quiet or is not buying" },
                exhausted: { vi: "Hết 30 vòng mà chưa chốt", en: "30 rounds without an order" },
            },
            max: TALK_ROUNDS,
            body: {
                start: "opening",
                nodes: {
                    // Round 1 has no event: its message is the hand-off's words. Every later round takes the person's next message first.
                    opening: ifNode({ label: { vi: "Vòng đầu?", en: "First round?" }, when: equals(round(), 1), yes: "consult", no: "hear" }),
                    hear: wait({
                        label: { vi: "Chờ khách nhắn", en: "Wait for the customer's message" },
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
                        // `declined` (a person declined the answer on its card) is the step's unsuccessful ending: the engine tells the team and
                        // the run ends `declined` before the loop's check; the route is the node's own and stays wired.
                        routes: { asked: endRound, ready: endRound, cancel: endRound, declined: endRound, off: "off-round" },
                        unsuccessful: DECLINED_ENDS,
                    }),
                    // Not about a sale (the model's judgement): a round that waited hands its message back; round 1 has no wait to hand it
                    // back to, so the team is told the route and the words on /chat (R41 Q10: never silent) and the talk ends.
                    "off-round": ifNode({
                        label: { vi: "Vòng đầu?", en: "First round?" },
                        when: equals(round(), 1),
                        yes: "not-sale-notice",
                        no: "give-back-talk",
                    }),
                    // Inside the round (v28): the round then ENDS on this node step, so the loop's `last` is the notice's own output (`posted`).
                    "not-sale-notice": node(salesNotSaleNoticeNode, {
                        input: { routeId: ref("trigger.data.conversationId"), text: ref("trigger.data.text"), locale: LOCALE },
                        next: endRound,
                    }),
                    "give-back-talk": handBack({ label: { vi: "Trả lại tin", en: "Hand the message back" }, wait: "hear" }),
                },
            },
            next: "keep-occasions",
            exhausted: "quiet",
        }),
        // The occasions the customer mentioned on the way are kept first (a side step), whatever the talk came to; with none the node keeps
        // nothing and calls no tool. Declined: the engine tells the team and the sale goes on where the talk left it.
        "keep-occasions": node(salesOccasionKeepNode, {
            input: { contactId: CONSULT.contactId, occasions: draftRef("occasions") },
            next: "not-sale-said",
            unsuccessful: { then: "continue" },
        }),
        // The talk stopped on round 1's "not about a sale": that round ended on `not-sale-notice` (the team was told), so the loop's `last`
        // is the notice's output, the only round-ending step that answers `posted` (a structural member, posted or not).
        "not-sale-said": ifNode({
            label: { vi: "Không phải mua hàng?", en: "Not a sale?" },
            when: present(ref("steps.talk.output.last.posted", { default: null })),
            yes: "not-sale",
            no: "ready-said",
        }),
        "not-sale": outcome({ name: "not-sale", label: { vi: "Không phải mua hàng", en: "Not a sale" } }),
        "ready-said": ifNode({
            label: { vi: "Khách chốt đơn?", en: "Ready to order?" },
            when: equals(CONSULT.branch, "ready"),
            yes: "create-order",
            no: "cancel-said",
        }),
        "create-order": node(salesOrderCreateNode, {
            input: {
                contactId: CONSULT.contactId,
                items: draftRef("items"),
                address: draftRef("address"),
                recipientName: draftRef("recipientName"),
                recipientPhone: draftRef("recipientPhone"),
                deliveryAt: draftRef("deliveryAt"),
            },
            next: "request-qr",
            // Declined: no order exists, the customer is left without its code. The engine tells the team, the run ends `declined`.
            unsuccessful: DECLINED_ENDS,
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
            next: "pay",
            unsuccessful: { ...DECLINED_ENDS, facts: [ORDER] },
        }),
        pay: loop({
            label: { vi: "Thanh toán", en: "Payment" },
            until: present(ref("steps.paid-order.output.orderNo", { default: null })),
            exits: {
                until: { vi: "Thoát khi đơn đã trả", en: "Leaves when the order is paid" },
                exhausted: { vi: "Hết 6 vòng mà chưa trả", en: "6 rounds and still unpaid" },
            },
            max: PAY_ROUNDS,
            body: {
                start: "await",
                nodes: {
                    await: wait({
                        label: { vi: "Chờ tiền về hoặc tin khách", en: "Wait for the money or a message" },
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
                        label: { vi: "Đủ tiền?", en: "Exact amount?" },
                        when: equals(ref("steps.credit.output.amountVnd"), ref("steps.create-order.output.amountVnd")),
                        yes: "paid-order",
                        no: "short",
                    }),
                    // Declined on its card (R41 Q8): the order stays unpaid; the engine tells the team which order, the run ends `declined`.
                    "paid-order": node(salesOrderPaidNode, {
                        input: { orderId: ref("steps.create-order.output.orderId") },
                        next: endRound,
                        unsuccessful: { ...DECLINED_ENDS, facts: [ORDER] },
                    }),
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
                    // An answer about the order that did not reach the customer: the engine tells the team, the wait goes on (R45, R68).
                    "order-talk": node(salesOrderTalkNode, {
                        input: {
                            contactId: CONSULT.contactId,
                            text: ref("steps.await.output.event.data.text", { default: "" }),
                            orderNo: ref("steps.create-order.output.orderNo"),
                            amountVnd: ref("steps.create-order.output.amountVnd"),
                            locale: LOCALE,
                        },
                        // `off`: not about the order: the message goes back to whoever else waits for it (the front desk), the round ends.
                        routes: { about: endRound, off: "give-back" },
                        unsuccessful: { facts: [ORDER] },
                    }),
                    "give-back": handBack({ label: { vi: "Trả lại tin", en: "Hand the message back" }, wait: "await" }),
                    // A reminder the channel refused (a closed window, an opted-out customer): the engine tells the team, the wait goes on.
                    remind: node(salesPaymentRemindNode, {
                        input: {
                            contactId: CONSULT.contactId,
                            orderNo: ref("steps.create-order.output.orderNo"),
                            amountVnd: ref("steps.create-order.output.amountVnd"),
                            locale: LOCALE,
                        },
                        next: endRound,
                        unsuccessful: { facts: [ORDER] },
                    }),
                },
            },
            next: "to-after-sale",
            // Out of rounds: the engine tells the team the order and its total (R45), the run ends `unpaid`.
            exhausted: "unpaid",
            unsuccessful: { facts: [ORDER, TOTAL] },
        }),
        "to-after-sale": callWorkflow({
            agent: "sales",
            workflow: "after-sale",
            version: "latest",
            input: {
                orderId: ref("steps.create-order.output.orderId"),
                orderNo: ref("steps.create-order.output.orderNo"),
                contactId: CONSULT.contactId,
            },
            next: "paid",
        }),
        paid: outcome({
            name: "paid",
            label: { vi: "Đã trả", en: "Paid" },
            output: { contactId: ref("trigger.data.contactId", { default: null }), orderId: ref("steps.create-order.output.orderId"), orderNo: ref("steps.create-order.output.orderNo") },
        }),
        unpaid: outcome({
            name: "unpaid",
            label: { vi: "Chưa trả", en: "Unpaid" },
            output: { contactId: ref("trigger.data.contactId", { default: null }), orderId: ref("steps.create-order.output.orderId"), orderNo: ref("steps.create-order.output.orderNo") },
        }),
        "cancel-said": ifNode({
            label: { vi: "Khách hủy đơn?", en: "Cancel the order?" },
            when: equals(CONSULT.branch, "cancel"),
            yes: "cancel-read",
            no: "quiet",
        }),
        // The cancel branches on DATA: the order's status as its record keeps it. A paid order is not cancelled by the flow: the team is told.
        "cancel-read": node(salesOrderReadNode, { input: { orderId: draftRef("cancelOrderId") }, next: "cancel-paid" }),
        "cancel-paid": ifNode({
            label: { vi: "Đơn đã trả?", en: "Already paid?" },
            when: equals(ref("steps.cancel-read.output.status"), "paid"),
            yes: "cancel-paid-notice",
            no: "cancel-order",
        }),
        "cancel-paid-notice": node(salesCancelPaidNoticeNode, {
            input: { orderNo: ref("steps.cancel-read.output.orderNo"), reason: draftRef("cancelReason"), text: ref("trigger.data.text"), locale: LOCALE },
            next: "quiet",
        }),
        "cancel-order": node(salesOrderCancelNode, {
            input: { orderId: ref("steps.cancel-read.output.orderId"), reason: draftRef("cancelReason") },
            next: "tell-cancelled",
            unsuccessful: { ...DECLINED_ENDS, facts: [{ label: ORDER_LABEL, value: ref("steps.cancel-read.output.orderNo") }] },
        }),
        "tell-cancelled": node(salesOrderCancelTellNode, {
            input: {
                conversationId: ref("trigger.data.conversationId"),
                orderNo: ref("steps.cancel-order.output.orderNo", { default: null }),
                locale: LOCALE,
            },
            next: "quiet",
            unsuccessful: { ...DECLINED_ENDS, facts: [{ label: ORDER_LABEL, value: ref("steps.cancel-order.output.orderNo", { default: null }) }] },
        }),
        declined: outcome({ name: "declined", label: { vi: "Bị từ chối", en: "Declined" } }),
        // The person went quiet, or the talk ended with nothing to order: the run ends; a later message starts at the front desk again.
        quiet: outcome({ name: "quiet", label: { vi: "Khách im lặng", en: "Customer went quiet" } }),
    },
})
