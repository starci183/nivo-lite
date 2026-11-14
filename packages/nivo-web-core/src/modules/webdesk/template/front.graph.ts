import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
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
import {
    chatbotAnswerNode,
    chatbotComplaintNotifyNode,
    chatbotComplaintReplyNode,
    teamDeclinedNoticeNode,
} from "@nivo-lite/blocks-core"
import { z } from "zod"
import { ID_MAX, TEXT_MAX } from "../../../nodes/webdesk/desk-shapes"
import { webdeskUnderstandSalesNode } from "../../../nodes/webdesk/understand-sales.node"

/** The key of the front-door workflow of the Support agent. */
export const WEBDESK_FRONT_KEY = "webdesk.front"

/**
 * The graph's contract: the GENERIC trigger scope of a Zalo message on the one event pipeline (ROAD-API 3.1): the route, the contact, the
 * event's subject (the channel and the person on it) and its data (one line).
 */
const frontInput = z.object({
    routeId: z.string().min(1).max(ID_MAX),
    contactId: z.string().max(ID_MAX).nullish(),
    subject: z.object({ channel: z.string().min(1).max(ID_MAX), id: z.string().min(1).max(ID_MAX) }),
    data: z.object({ text: z.string().min(1).max(TEXT_MAX), files: z.array(z.unknown()).nullish() }),
})

/** What a hand-off to a conversation workflow carries: the route (the callee's `conversationId` input), the words, the channel, the contact. */
const conversationOf = {
    conversationId: ref("trigger.routeId"),
    text: ref("trigger.data.text"),
    channel: ref("trigger.subject.channel"),
    contactId: ref("trigger.contactId"),
}

/** The language of the graph's steps (the team reads Vietnamese): the declined notices name their step in it. */
const LOCALE = "vi"

/** The vi titles of the two Chatbot send steps (their catalogue titles), as the declined notices name them. */
const COMPLAINT_REPLY_STEP = "Tr\u1ea3 l\u1eddi khi\u1ebfu n\u1ea1i"
const ANSWER_STEP = "Tr\u1ea3 l\u1eddi c\u00e2u h\u1ecfi"

/** What the template catalogue shows of version 6: the texts of version 5, the change note of 6 (rights: one mode per node). */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "Ti\u1ebfp nh\u1eadn tin kh\u00e1ch", en: "Take a customer's message" },
    summary: {
        vi: "\u0110\u00f3n tin Zalo c\u1ee7a kh\u00e1ch: b\u00e1o l\u1ed7i th\u00ec m\u1edf phi\u1ebfu v\u00e0 x\u1eed l\u00fd s\u1ef1 c\u1ed1, gia h\u1ea1n th\u00ec chuy\u1ec3n Gia h\u1ea1n, mu\u1ed1n mua d\u1ecbch v\u1ee5 m\u1edbi th\u00ec chuy\u1ec3n Kinh doanh, khi\u1ebfu n\u1ea1i th\u00ec xin l\u1ed7i v\u00e0 b\u00e1o \u0111\u1ed9i, c\u00f2n l\u1ea1i tr\u1ea3 l\u1eddi t\u1eeb th\u00f4ng tin c\u00f4ng khai",
        en: "Greets a customer's Zalo message: a fault opens a ticket and the incident flow, a renewal goes to the Renewal agent, something new to buy goes to the Sales agent, a complaint is apologised for and told to the team, anything else is answered from public information",
    },
    version: 12,
    publishedAt: "2026-11-14T04:50:00.000Z",
    notes: {
        vi: "Thời gian gom tin nhắn do khai báo của trigger quyết định, đồ thị không còn tự khai báo",
        en: "How long a burst of messages settles is the trigger declaration's, no longer the graph's",
    },
}

/**
 * `webdesk.front` version 5 (the Support agent's primary graph): a customer's Zalo message wakes it; the front door understands what
 * the customer wants and routes it. Fault -> the incident (`webdesk.ticket`); renewal -> the Renewal agent's answer; something new to buy
 * -> the Sales agent's enquiry; complaint -> the Chatbot's reply to the customer, then its side notice to the team, then the person
 * outcome; anything else -> one answer from public information. The two customer sends (the Chatbot steps) run by themselves (`auto`, the node's own mode). Change from version 4: the complaint step is the Chatbot's split pair (`complaint-reply`,
 * `complaint-notify`); the hand-offs are `callWorkflow`s (the engine keys them); no `lead.*` ref and no ref default. A person who declines (a shop that sets `ask` on its copy)
 * one of the two customer sends (the complaint reply, the answer) decided so: the step returns `declined`, the graph tells the team in
 * one notice (`complaint-notice`, `answer-notice`: `team.declined-notice`) and ends `declined`; the complaint's team notice is not sent.
 */
export const webdeskFrontGraph: TemplateGraph = defineTemplateGraph({
    key: WEBDESK_FRONT_KEY,
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: frontInput,
    triggers: [
        trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa] }),
    ],
    openTo: "any",
    start: "understand",
    nodes: {
        understand: node(webdeskUnderstandSalesNode, {
            input: { text: ref("trigger.data.text") },
            routes: {
                fault: "to-ticket",
                renewal: "to-renewal",
                complaint: "complaint-reply",
                sales: "to-sales",
                question: "answer",
            },
        }),
        "to-ticket": callWorkflow({
            agent: "webdesk",
            workflow: "ticket",
            version: "latest",
            input: { ...conversationOf, summary: ref("steps.understand.output.summary") },
        }),
        "to-renewal": callWorkflow({ agent: "webrenew", workflow: "answer", version: "latest", input: conversationOf }),
        "to-sales": callWorkflow({
            agent: "websales",
            workflow: "enquiry",
            version: "latest",
            input: { ...conversationOf, summary: ref("steps.understand.output.summary") },
        }),
        "complaint-reply": node(chatbotComplaintReplyNode, {
            input: {
                conversationId: ref("trigger.routeId"),
                text: ref("trigger.data.text"),
                summary: ref("steps.understand.output.summary"),
            },
            next: "complaint-declined",
        }),
        "complaint-declined": ifNode({
            when: equals(ref("steps.complaint-reply.output.declined"), true),
            yes: "complaint-notice",
            no: "complaint-notify",
        }),
        "complaint-notice": node(teamDeclinedNoticeNode, {
            input: {
                step: COMPLAINT_REPLY_STEP,
                ref: ref("steps.complaint-reply.output.orderCode"),
                locale: LOCALE,
            },
            next: "declined",
        }),
        "complaint-notify": node(chatbotComplaintNotifyNode, {
            input: {
                text: ref("trigger.data.text"),
                summary: ref("steps.complaint-reply.output.summary"),
                orderCode: ref("steps.complaint-reply.output.orderCode"),
            },
            next: "to-person",
        }),
        "to-person": outcome({ name: "person", output: { summary: ref("steps.complaint-reply.output.summary") } }),
        answer: node(chatbotAnswerNode, {
            input: { conversationId: ref("trigger.routeId"), text: ref("trigger.data.text") },
            next: "answer-declined",
        }),
        // Sent: no `no`, the run ends after the answer as before.
        "answer-declined": ifNode({
            when: equals(ref("steps.answer.output.declined"), true),
            yes: "answer-notice",
        }),
        "answer-notice": node(teamDeclinedNoticeNode, {
            input: { step: ANSWER_STEP, ref: null, locale: LOCALE },
            next: "declined",
        }),
        declined: outcome({ name: "declined" }),
    },
})
