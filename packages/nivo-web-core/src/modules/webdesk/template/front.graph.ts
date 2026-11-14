import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    callWorkflow,
    defineTemplateGraph,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import {
    chatbotAnswerNode,
    chatbotComplaintNotifyNode,
    chatbotComplaintReplyNode,
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

/** What the template catalogue shows of version 13: the texts of version 5, the change note of 13 (R68: the engine reports unsuccessful steps). */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "Ti\u1ebfp nh\u1eadn tin kh\u00e1ch", en: "Take a customer's message" },
    summary: {
        vi: "\u0110\u00f3n tin Zalo c\u1ee7a kh\u00e1ch: b\u00e1o l\u1ed7i th\u00ec m\u1edf phi\u1ebfu v\u00e0 x\u1eed l\u00fd s\u1ef1 c\u1ed1, gia h\u1ea1n th\u00ec chuy\u1ec3n Gia h\u1ea1n, mu\u1ed1n mua d\u1ecbch v\u1ee5 m\u1edbi th\u00ec chuy\u1ec3n Kinh doanh, khi\u1ebfu n\u1ea1i th\u00ec xin l\u1ed7i v\u00e0 b\u00e1o \u0111\u1ed9i, c\u00f2n l\u1ea1i tr\u1ea3 l\u1eddi t\u1eeb th\u00f4ng tin c\u00f4ng khai",
        en: "Greets a customer's Zalo message: a fault opens a ticket and the incident flow, a renewal goes to the Renewal agent, something new to buy goes to the Sales agent, a complaint is apologised for and told to the team, anything else is answered from public information",
    },
    version: 13,
    publishedAt: "2026-11-14T22:00:00.000Z",
    notes: {
        vi: "R68: lời trả lời khách bị chặn hoặc bị từ chối duyệt thì hệ thống tự báo đội và kết thúc bị từ chối; quy trình chỉ còn các bước nghiệp vụ",
        en: "R68: a customer reply that was refused or declined is told to the team by the engine and the run ends declined; the workflow keeps only its business steps",
    },
}

/**
 * `webdesk.front` version 5 (the Support agent's primary graph): a customer's Zalo message wakes it; the front door understands what
 * the customer wants and routes it. Fault -> the incident (`webdesk.ticket`); renewal -> the Renewal agent's answer; something new to buy
 * -> the Sales agent's enquiry; complaint -> the Chatbot's reply to the customer, then its side notice to the team, then the person
 * outcome; anything else -> one answer from public information. The two customer sends (the Chatbot steps) run by themselves (`auto`, the node's own mode). Change from version 4: the complaint step is the Chatbot's split pair (`complaint-reply`,
 * `complaint-notify`); the hand-offs are `callWorkflow`s (the engine keys them); no `lead.*` ref and no ref default. A person who declines (a shop that sets `ask` on its copy)
 * one of the two customer sends (the complaint reply, the answer) decided so, and a send the channel refused (not `route_held`): it is
 * the step's unsuccessful ending (R68): the ENGINE tells the team (the step, the typed reason) and the run ends `declined`; the
 * complaint's team notice is not sent. Change from version 12 (R68): the hand-drawn `complaint-declined`/`complaint-notice` and
 * `answer-declined`/`answer-notice` pairs are the two send steps' `unsuccessful` option.
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
            next: "complaint-notify",
            unsuccessful: { then: "end", outcome: "declined" },
        }),
        "complaint-notify": node(chatbotComplaintNotifyNode, {
            input: {
                text: ref("trigger.data.text"),
                summary: ref("steps.complaint-reply.output.summary"),
                orderCode: ref("steps.complaint-reply.output.orderCode"),
            },
            next: "to-person",
        }),
        "to-person": outcome({ name: "person", label: { vi: "Chuyển người xử lý khiếu nại", en: "Complaint to a person" }, output: { summary: ref("steps.complaint-reply.output.summary") } }),
        answer: node(chatbotAnswerNode, {
            input: { conversationId: ref("trigger.routeId"), text: ref("trigger.data.text") },
            // Sent: no `next`, the run ends after the answer as before.
            unsuccessful: { then: "end", outcome: "declined" },
        }),
        declined: outcome({ name: "declined", label: { vi: "Bị từ chối", en: "Declined" } }),
    },
})
