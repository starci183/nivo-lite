import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    absent,
    defineTemplateGraph,
    endRound,
    equals,
    handBack,
    ifNode,
    item,
    loop,
    node,
    or,
    outcome,
    present,
    ref,
    round,
    trigger,
    wait,
    waitFor,
} from "@nivo-lite/agent-sdk/template"
import { teamDeclinedNoticeNode } from "@nivo-lite/blocks-core"
import { z } from "zod"
import { webrenewCloseRecordNode } from "../../../nodes/webrenew/close-record.node"
import { webrenewCloseTeamNode } from "../../../nodes/webrenew/close-team.node"
import { webrenewCloseThankNode } from "../../../nodes/webrenew/close-thank.node"
import { webrenewPaidAckNode } from "../../../nodes/webrenew/paid-ack.node"
import { webrenewPaidTeamNode } from "../../../nodes/webrenew/paid-team.node"
import { webrenewQuoteOpenNode } from "../../../nodes/webrenew/quote-open.node"
import { webrenewQuoteRecordNode } from "../../../nodes/webrenew/quote-record.node"
import { webrenewQuoteTellNode } from "../../../nodes/webrenew/quote-tell.node"
import { webrenewReplyAnswerNode } from "../../../nodes/webrenew/reply-answer.node"
import { webrenewRoundMessageNode } from "../../../nodes/webrenew/round-message.node"
import { webrenewUnderstandOpenNode } from "../../../nodes/webrenew/understand-open.node"
import { webrenewUnlinkedTellNode } from "../../../nodes/webrenew/unlinked-tell.node"
import { webdeskUnderstandSalesNode } from "../../../nodes/webdesk/understand-sales.node"
import { webrenewText } from "../copy"

/** The language the team reads (today's constant param). */
const LOCALE = "vi"

/** The graph's contract: what the caller (the support front desk) supplies; as version 5. */
const answerInput = z.object({
    text: z.string().min(1),
    conversationId: z.string().min(1).max(100).nullish(),
    contactId: z.string().min(1).max(100).nullish(),
    channel: z.string().min(1).max(100).nullish(),
    customerCode: z.string().min(1).max(80).nullish(),
})

/** Where the answer came from, as every customer-facing step takes it: the caller may pass neither id (null then). */
const SOURCE = {
    conversationId: ref("trigger.data.conversationId", { default: null }),
    contactId: ref("trigger.data.contactId", { default: null }),
    locale: LOCALE,
}

/** The rounds of the talk: one per message of the customer (R9: a body that parks at a wait may run 30). */
const TALK_ROUNDS = 30

/** The words THIS round answers (`message`: the hand-off's in round 1, the ones the round's wait took later). */
const ROUND_TEXT = ref("steps.message.output.text")

/** A member of the understand step that ended the talk: the loop's `last` (R46: the last NODE step of the final round). */
const ended = (member: string) => ref(`steps.talk.output.last.${member}`, { default: null })

/** The linked CRM customer the ending round's understand step read; null when the conversation is linked to none. */
const CUSTOMER_CODE = ended("customerCode")

/** The understand step's route in the round that just ended. */
const routed = (branch: string) => equals(ref("steps.understand.output.branch", { default: null }), branch)

/**
 * `webrenew.answer` version 14 (Customer answers a renewal): THE CONVERSATION AS ONE RUN (owner's rule, R53; the form of
 * `sales.consult`). The business of version 13 is kept step for step; only the form moved (WEBCORE-AUDIT.md, webrenew BEFORE / AFTER):
 * - TALK LOOP (`talk`, at most 30 rounds). Round 1 answers the front door's hand-off. Every later round parks at `hear` for the
 *   customer's next Zalo message (a day at most) and first runs the FRONT DOOR'S OWN judgement (`desk`, `webdesk.understand`, the step
 *   that decided whether a run of v13 started): `renewal` goes on; anything else is handed back (`give-back`) to the graphs registered
 *   on the message (the front door), where v13 would have sent it. `message` takes the round's words.
 * - Each round runs v13's `understand` (the conversation's linked CRM customer, four routes). ask: `reply` answers the customer; when the
 *   conversation is linked to no CRM customer (`linked`, an exact check) `unlinked-tell` tells the team (side); the round ends and the
 *   talk waits for the customer. agree, paid, no: the round ends and so does the talk.
 * - AFTER THE TALK (`settled`), read from the understand step that ended it (`last`): agree -> `open-each` (one renewal request per
 *   service) -> `tell` (the CRM's totals and payment codes) -> `record-each`; no -> `close-each` -> `close-team` (side) -> `close-thank`
 *   (side) -> `declined` with the reason; paid -> `paid-team` (side) -> `paid-ack`. Accounting hears of the money from the bank.
 * - Declined (a person declined a step a shop set to `ask`, a decision): inside a list loop the team is told and that service's item
 *   ends; on `tell`, `reply` and `paid-ack` the team is told and the run ends `declined` (reason null), as in v13; `reply` sits in the
 *   talk: its notice ends the round and the talk, then `declined`.
 * - The customer going quiet (a day without a message) or 30 rounds end the talk `answered`: the only rounds that do not end the talk
 *   are answered questions, so this is v13's outcome of the last message; a later message starts at the front door again.
 */
export const answerGraph: TemplateGraph = defineTemplateGraph({
    key: "webrenew.answer",
    title: { vi: "Khách trả lời gia hạn", en: "Customer answers a renewal" },
    input: z.object({ data: answerInput }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "talk",
    catalogue: {
        name: { vi: "Khách trả lời gia hạn", en: "Customer answers a renewal" },
        summary: {
            vi: "Lễ tân Hỗ trợ chuyển câu trả lời của khách: đồng ý thì báo giá và yêu cầu trả tiền trước, báo đã chuyển thì nhắn khách, báo đội (Kế toán nghe tiền từ ngân hàng), từ chối thì ghi nhận, hỏi thêm thì trả lời",
            en: "The support front desk passes the customer's answer on: agrees, quote and ask to pay first; says they paid, tell the customer and the team (Accounting hears of the money from the bank); declines, record it; asks, answer",
        },
        version: 14,
        // The old JSON template had `seedActive: true`: the seed makes an ACTIVE workflow from it.
        seedActive: true,
        publishedAt: "2026-11-14T16:00:00.000Z",
        notes: {
            vi: "Cả cuộc trò chuyện là một lượt chạy: mỗi tin sau của khách được Lễ tân đánh giá như trước, tin không phải về gia hạn được trả lại cho Lễ tân; các bước và quyết định không đổi",
            en: "The whole conversation is one run: each later message of the customer is judged by the front door's own step as before, one not about a renewal goes back to the front door; the steps and decisions are unchanged",
        },
    },
    nodes: {
        talk: loop({
            until: or(
                routed("agree"),
                routed("paid"),
                routed("no"),
                equals(ref("steps.reply.output.declined", { default: false }), true),
                equals(ref("steps.hear.output.trigger", { default: null }), "timeout"),
            ),
            max: TALK_ROUNDS,
            body: {
                start: "opening",
                nodes: {
                    // Round 1 has no event: its message is the hand-off's. Every later round takes the customer's next message first.
                    opening: ifNode({ when: equals(round(), 1), yes: "message", no: "hear" }),
                    hear: wait({
                        for: { zalo: waitFor(TRIGGER.zaloMessageReceived) },
                        timeout: "1d",
                        next: { zalo: "desk", timeout: endRound },
                    }),
                    // The front door's own judgement of the message (what started a run of v13): not about a renewal -> back to it.
                    desk: node(webdeskUnderstandSalesNode, {
                        input: { text: ref("steps.hear.output.event.data.text") },
                        routes: {
                            renewal: "message",
                            fault: "give-back",
                            sales: "give-back",
                            complaint: "give-back",
                            question: "give-back",
                        },
                    }),
                    "give-back": handBack({ wait: "hear" }),
                    message: node(webrenewRoundMessageNode, {
                        input: { handed: ref("trigger.data.text"), latest: ref("steps.hear.output.event.data.text", { default: null }) },
                        next: "understand",
                    }),
                    understand: node(webrenewUnderstandOpenNode, {
                        input: { text: ROUND_TEXT, ...SOURCE },
                        routes: { agree: endRound, paid: endRound, no: endRound, ask: "reply" },
                    }),
                    // ask
                    reply: node(webrenewReplyAnswerNode, {
                        input: {
                            text: ROUND_TEXT,
                            summary: ref("steps.understand.output.summary"),
                            customerCode: ref("steps.understand.output.customerCode", { default: null }),
                            ...SOURCE,
                        },
                        next: "reply-declined",
                    }),
                    "reply-declined": ifNode({
                        when: equals(ref("steps.reply.output.declined"), true),
                        yes: "reply-notice",
                        no: "linked",
                    }),
                    "reply-notice": node(teamDeclinedNoticeNode, {
                        input: {
                            step: webrenewText("node.reply.title").vi,
                            ref: ref("steps.understand.output.customerCode", { default: null }),
                            locale: LOCALE,
                        },
                        next: endRound,
                    }),
                    linked: ifNode({
                        when: absent(ref("steps.understand.output.customerCode")),
                        yes: "unlinked-tell",
                        no: endRound,
                    }),
                    "unlinked-tell": node(webrenewUnlinkedTellNode, {
                        input: {
                            contactId: ref("trigger.data.contactId", { default: null }),
                            summary: ref("steps.understand.output.summary"),
                            locale: LOCALE,
                        },
                        next: endRound,
                    }),
                },
            },
            next: "settled",
            exhausted: "answered",
        }),
        // The talk ended on its understand step (agree, paid, no): that output is the loop's `last`. Else the declined reply's notice
        // ended it (`posted`), or the customer went quiet after an answered question (a round of control steps only: `last` is null).
        settled: ifNode({ when: present(ended("branch")), yes: "agree-said", no: "declined-said" }),
        "declined-said": ifNode({ when: present(ended("posted")), yes: "declined", no: "answered" }),
        "agree-said": ifNode({ when: equals(ended("branch"), "agree"), yes: "open-each", no: "paid-said" }),
        "paid-said": ifNode({ when: equals(ended("branch"), "paid"), yes: "paid-team", no: "close-each" }),

        // agree
        "open-each": loop({
            over: ended("serviceCodes"),
            concurrency: 1,
            body: {
                start: "open",
                nodes: {
                    open: node(webrenewQuoteOpenNode, {
                        input: {
                            serviceCode: item(),
                            termMonths: ended("termMonths"),
                            locale: LOCALE,
                        },
                        next: "open-declined",
                    }),
                    // A person declined this request: the team is told, the item ends; the quote names the others.
                    "open-declined": ifNode({
                        when: equals(ref("steps.open.output.declined"), true),
                        yes: "open-notice",
                    }),
                    "open-notice": node(teamDeclinedNoticeNode, {
                        input: {
                            step: webrenewText("node.quoteOpen.title").vi,
                            ref: item(),
                            locale: LOCALE,
                            scope: "item",
                        },
                    }),
                },
                collect: "open",
            },
            next: "tell",
        }),
        tell: node(webrenewQuoteTellNode, {
            input: { customerCode: CUSTOMER_CODE, quotes: ref("steps.open-each.output"), ...SOURCE },
            next: "tell-declined",
        }),
        "tell-declined": ifNode({
            when: equals(ref("steps.tell.output.declined"), true),
            yes: "tell-notice",
            no: "record-each",
        }),
        "tell-notice": node(teamDeclinedNoticeNode, {
            input: { step: webrenewText("node.quoteTell.title").vi, ref: CUSTOMER_CODE, locale: LOCALE },
            next: "declined",
        }),
        // Over the services the customer was told a quote for (`tell` answers them, never null), one record each.
        "record-each": loop({
            over: ref("steps.tell.output.serviceCodes"),
            concurrency: 1,
            body: {
                start: "record",
                nodes: {
                    record: node(webrenewQuoteRecordNode, {
                        input: {
                            serviceCode: item(),
                            channel: ref("steps.tell.output.channel", { default: null }),
                            messageRef: ref("steps.tell.output.messageRef", { default: null }),
                        },
                        next: "record-declined",
                    }),
                    "record-declined": ifNode({
                        when: equals(ref("steps.record.output.declined"), true),
                        yes: "record-notice",
                    }),
                    "record-notice": node(teamDeclinedNoticeNode, {
                        input: {
                            step: webrenewText("node.quoteRecord.title").vi,
                            ref: item(),
                            locale: LOCALE,
                            scope: "item",
                        },
                    }),
                },
                collect: "record",
            },
        }),

        // no
        "close-each": loop({
            over: ended("serviceCodes"),
            concurrency: 1,
            body: {
                start: "close-record",
                nodes: {
                    "close-record": node(webrenewCloseRecordNode, {
                        input: { serviceCode: item(), channel: ref("trigger.data.channel", { default: null }) },
                        next: "close-declined",
                    }),
                    "close-declined": ifNode({
                        when: equals(ref("steps.close-record.output.declined"), true),
                        yes: "close-notice",
                    }),
                    "close-notice": node(teamDeclinedNoticeNode, {
                        input: {
                            step: webrenewText("node.close.title").vi,
                            ref: item(),
                            locale: LOCALE,
                            scope: "item",
                        },
                    }),
                },
                collect: "close-record",
            },
            next: "close-team",
        }),
        "close-team": node(webrenewCloseTeamNode, {
            input: {
                customerCode: CUSTOMER_CODE,
                recorded: ref("steps.close-each.output"),
                text: ended("text"),
                summary: ended("summary"),
                locale: LOCALE,
            },
            next: "close-thank",
        }),
        "close-thank": node(webrenewCloseThankNode, {
            input: { text: ended("text"), summary: ended("summary"), ...SOURCE },
            next: "declined",
        }),
        // A no: the customer's (`reason` from close-team) or a person's decline of an asked step outside a list loop (tell, reply,
        // paid-ack: the team was told; nothing else runs; `reason` is null).
        declined: outcome({
            name: "declined",
            output: { reason: ref("steps.close-team.output.reason", { default: null }) },
        }),
        // The talk ended after answered questions (the customer went quiet, or 30 rounds): v13's outcome of an answered question.
        answered: outcome({ name: "answered" }),

        // paid
        "paid-team": node(webrenewPaidTeamNode, {
            input: {
                text: ended("text"),
                summary: ended("summary"),
                customerCode: CUSTOMER_CODE,
                serviceCodes: ended("serviceCodes"),
                renewalId: ended("renewalId"),
                locale: LOCALE,
            },
            next: "paid-ack",
        }),
        "paid-ack": node(webrenewPaidAckNode, {
            input: { text: ended("text"), ...SOURCE },
            next: "paid-declined",
        }),
        "paid-declined": ifNode({
            when: equals(ref("steps.paid-ack.output.declined"), true),
            yes: "paid-notice",
        }),
        "paid-notice": node(teamDeclinedNoticeNode, {
            input: { step: webrenewText("node.paidAck.title").vi, ref: CUSTOMER_CODE, locale: LOCALE },
            next: "declined",
        }),
    },
})
