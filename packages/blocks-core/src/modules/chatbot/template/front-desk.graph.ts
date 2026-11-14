import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    callWorkflow,
    defineTemplateGraph,
    equals,
    ifNode,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { chatbotAnswerNode } from "../../../nodes/chatbot/answer.node"
import { chatbotComplaintNotifyNode } from "../../../nodes/chatbot/complaint-notify.node"
import { chatbotComplaintReplyNode } from "../../../nodes/chatbot/complaint-reply.node"
import { chatbotHearNode } from "../../../nodes/chatbot/hear.node"
import { chatbotUnderstandNode } from "../../../nodes/chatbot/understand.node"
import { teamDeclinedNoticeNode } from "../../../nodes/team/declined-notice.node"
import { messageOf } from "../../../messages/catalog"

/** The key of the front-desk workflow inside the Chatbot agent. */
export const FRONT_DESK_GRAPH_KEY = "chatbot.front-desk"

/** The name of the front desk, as the market and the workflow list show it. */
const FRONT_DESK_NAME = { vi: "Lễ tân", en: "Front desk" }

/**
 * The graph's contract: the GENERIC trigger scope of a channel message (ROAD-API 3.1, triggers rule 13): the route, the contact and the
 * account the engine met the person on, the event's subject and its data (one line; the rest of a burst is the run's queue). No chat member.
 */
const frontDeskInput = z.object({
    eventId: z.string().min(1).max(MAX_ID),
    routeId: z.string().min(1).max(MAX_ID),
    contactId: z.string().max(MAX_ID).nullish(),
    accountId: z.string().max(MAX_ID).nullish(),
    subject: z.object({ channel: z.string().min(1).max(MAX_ID), id: z.string().min(1).max(MAX_ID), name: z.string().max(MAX_ID).nullish() }).nullish(),
    // Empty words for a picture-only line, a `/start` read by `hear` and the release door's resume (`data.resume`).
    data: z.object({
        messageKey: z.string().max(MAX_ID).nullish(),
        text: z.string().default(""),
        at: z.string().max(MAX_ID).nullish(),
        files: z.array(z.unknown()).nullish(),
        resume: z.string().max(MAX_ID).nullish(),
    }),
})

/**
 * What a hand-off to the Sales consult carries: the route (the callee's `conversationId` input: where it was woken, which its send defaults
 * to), the words heard, the channel of the conversation, the person and where the visit's window on the route's lines starts (`since`:
 * the consult reads the engine's thread from then on, the customer's pictures included).
 */
const consultHandOff = {
    conversationId: ref("trigger.routeId"),
    text: ref("steps.hear.output.text"),
    channel: ref("steps.hear.output.channel"),
    contactId: ref("trigger.contactId", { default: null }),
    since: ref("steps.hear.output.startedAt"),
}

/** What a hand-off to the Booking carries: the route, the words, the channel, the customer and the recent lines (its input contract). */
const bookingHandOff = {
    conversationId: ref("trigger.routeId"),
    text: ref("steps.hear.output.text"),
    channel: ref("steps.hear.output.channel"),
    contactId: ref("trigger.contactId", { default: null }),
    recentLines: ref("steps.understand.output.recentLines"),
}

/**
 * What a hand-off to the Sales money-in graph carries when a customer says they paid: the route, the words and the customer (its input
 * contract has no `channel`: the line leaves through the person's own account, contract C3).
 */
const paidHandOff = {
    conversationId: ref("trigger.routeId"),
    text: ref("steps.hear.output.text"),
    contactId: ref("trigger.contactId", { default: null }),
}

/**
 * `chatbot.front-desk` (the Chatbot's primary graph; the version is the catalogue's): a customer's message on Zalo OA, Telegram, Facebook
 * or Instagram wakes it (each channel its own trigger verb, ruling R6) with the one event pipeline's generic trigger scope (route, contact,
 * account, subject, data). `hear` reads the line from `data` and the rest of a burst from the run's queue (`ctx.run.queue`), finds or opens
 * the route's chat and tells Telegram's `/start` itself (a fresh visit: the chat's window starts there and the run goes on with no words,
 * so the model greets; ruling R45). `understand` reads the words and the pictures (a picture-only line has no words) and routes: buy -> the
 * Sales consult (with the visit's start, `since`: it reads the engine's thread itself); book -> the Booking `book` (with the recent lines);
 * paid -> the Sales money-in graph (`sales.payment`: it answers the customer and tells the team; the money settles on the bank's credit);
 * complaint -> one reply to the customer, then a side notice to the team, then the owner's outcome; question -> one answer from the
 * shop's public knowledge. A declined send tells the team and ends `declined`. Who holds the thread is the ENGINE's staff hold on the
 * route (ruling R43): the engine starts no run for a held route and its send door refuses every AI send to one (`route_held`); the graph
 * knows nothing of it.
 */
export const frontDeskGraph: TemplateGraph = defineTemplateGraph({
    key: FRONT_DESK_GRAPH_KEY,
    title: FRONT_DESK_NAME,
    input: frontDeskInput,
    triggers: [
        trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa] }),
        trigger(TRIGGER.telegramMessageReceived, { accounts: [PROVIDER.telegram] }),
        trigger(TRIGGER.facebookMessageReceived, { accounts: [PROVIDER.meta] }),
        trigger(TRIGGER.instagramMessageReceived, { accounts: [PROVIDER.meta] }),
    ],
    openTo: "any",
    start: "hear",
    nodes: {
        // The first step: the chatbot's own records. It stores no line (the engine kept it at delivery, R26): it finds or opens the
        // route's chat (a new one on `/start`) and marks it unanswered. A staff hold is the engine's: its send door refuses the AI (R43).
        hear: node(chatbotHearNode, {
            input: {
                routeId: ref("trigger.routeId"),
                contactId: ref("trigger.contactId", { default: null }),
                subject: ref("trigger.subject", { default: null }),
                data: ref("trigger.data"),
            },
            routes: { go: "understand", nothing: "nothing-to-answer" },
        }),
        "nothing-to-answer": outcome({ name: "nothing" }),
        understand: node(chatbotUnderstandNode, {
            input: { text: ref("steps.hear.output.text"), messages: ref("steps.hear.output.messages"), since: ref("steps.hear.output.startedAt") },
            routes: { buy: "to-consult", book: "to-booking", paid: "to-payment", complaint: "complaint-reply", question: "answer" },
        }),
        "to-consult": callWorkflow({ agent: "sales", workflow: "consult", version: "latest", input: consultHandOff }),
        // The booking has its own input contract (the customer by `contactId`, the core contact); a workspace without the Booking module installed has no such workflow, and a
        // hand-off to a workflow that is not there is the engine's one failure path (reported to /chat, frozen), as for every hand-off.
        "to-booking": callWorkflow({ agent: "booking", workflow: "book", version: "latest", input: bookingHandOff }),
        "to-payment": callWorkflow({ agent: "sales", workflow: "payment", version: "latest", input: paidHandOff }),
        "complaint-reply": node(chatbotComplaintReplyNode, {
            input: {
                conversationId: ref("steps.hear.output.conversationId"),
                text: ref("steps.hear.output.text"),
                summary: ref("steps.understand.output.summary"),
                since: ref("steps.hear.output.startedAt"),
            },
            next: "complaint-declined",
        }),
        // The sends are `auto` here; an owner may set them to `ask`, and a "no" on the card is a decision: one team notice, then the
        // outcome `declined` (DECLINED.md, the owner's rule of 2026-11-12).
        "complaint-declined": ifNode({
            when: equals(ref("steps.complaint-reply.output.declined"), true),
            yes: "complaint-declined-notice",
            no: "complaint-notify",
        }),
        "complaint-declined-notice": node(teamDeclinedNoticeNode, {
            input: {
                step: messageOf("vi", "nodeChatbotComplaintReplyTitle"),
                ref: ref("steps.complaint-reply.output.orderCode"),
            },
            next: "declined",
        }),
        "complaint-notify": node(chatbotComplaintNotifyNode, {
            input: {
                text: ref("steps.hear.output.text"),
                summary: ref("steps.complaint-reply.output.summary"),
                orderCode: ref("steps.complaint-reply.output.orderCode"),
            },
            next: "to-owner",
        }),
        "to-owner": outcome({ name: "owner", output: { summary: ref("steps.complaint-reply.output.summary") } }),
        answer: node(chatbotAnswerNode, {
            input: { conversationId: ref("steps.hear.output.conversationId"), text: ref("steps.hear.output.text"), since: ref("steps.hear.output.startedAt") },
            next: "answer-declined",
        }),
        // An answered question ends the run as before (no `no`); a declined answer is told to the team and ends `declined`.
        "answer-declined": ifNode({
            when: equals(ref("steps.answer.output.declined"), true),
            yes: "answer-declined-notice",
        }),
        "answer-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: messageOf("vi", "nodeChatbotAnswerTitle"), ref: null },
            next: "declined",
        }),
        declined: outcome({ name: "declined" }),
    },
    catalogue: {
        name: FRONT_DESK_NAME,
        summary: {
            vi: "Đón tin nhắn Zalo, Telegram, Facebook và Instagram, trả lời và chuyển đúng quy trình",
            en: "Greets Zalo, Telegram, Facebook and Instagram messages, answers and passes on to the right workflow",
        },
        version: 25,
        publishedAt: "2026-11-14T14:00:00.000Z",
        notes: {
            vi: "Tin chỉ có hình cũng được hiểu; /start không kèm lời thì AI chào khách; bán hàng tự đọc cuộc trò chuyện (cả hình) từ lúc bắt đầu lượt ghé",
            en: "A picture-only line is understood; a /start with no words gets the model's greeting; the sale reads the conversation (pictures included) from the visit's start itself",
        },
    },
})
