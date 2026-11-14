import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    absent,
    defineTemplateGraph,
    equals,
    ifNode,
    node,
    outcome,
    present,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { teamDeclinedNoticeNode } from "@nivo-lite/blocks-core"
import { z } from "zod"
import { webdeskAnswerPlanNode } from "../../../nodes/webdesk/answer-plan.node"
import { webdeskCheckNode } from "../../../nodes/webdesk/check.node"
import { webdeskCustomerReplyNode } from "../../../nodes/webdesk/customer-reply.node"
import { ID_MAX, LINE_MAX, TEXT_MAX } from "../../../nodes/webdesk/desk-shapes"
import { webdeskIntakeLinkedNode } from "../../../nodes/webdesk/intake-linked.node"
import { webdeskTeamTellNode } from "../../../nodes/webdesk/team-tell.node"
import { webdeskTicketNoteNode } from "../../../nodes/webdesk/ticket-note.node"
import { webdeskCopy } from "../copy"

/** The key of the incident workflow of the Support agent. */
export const WEBDESK_TICKET_KEY = "webdesk.ticket"

/** The graph's contract: what the front door's hand-off supplies (`text` alone is required, as in version 5). */
const ticketInput = z.object({
    text: z.string().min(1).max(TEXT_MAX),
    conversationId: z.string().min(1).max(ID_MAX).nullish(),
    contactId: z.string().min(1).max(ID_MAX).nullish(),
    channel: z.string().min(1).max(ID_MAX).nullish(),
    customerCode: z.string().min(1).max(ID_MAX).nullish(),
    summary: z.string().max(LINE_MAX).nullish(),
})

/** The name the steps write their ticket notes under: the agent's label as the team reads it. */
const AUTHOR = webdeskCopy("agent.label", "vi")

/** The language of the graph's steps (the team reads Vietnamese): the declined notices name their step in it. */
const LOCALE = "vi"

/** What the template catalogue shows of version 7: the texts of version 6, the change note of 7 (rights: one mode per node). */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "X\u1eed l\u00fd s\u1ef1 c\u1ed1", en: "Handle an incident" },
    summary: {
        vi: "M\u1edf phi\u1ebfu cho l\u1ed7i kh\u00e1ch b\u00e1o, ki\u1ec3m tra h\u1ec7 th\u1ed1ng tr\u01b0\u1edbc, r\u1ed3i g\u1eedi \u0111\u1ed9i c\u00e1ch s\u1eeda \u0111\u1ec1 xu\u1ea5t v\u00e0 tr\u1ea3 l\u1eddi kh\u00e1ch (b\u00e1o gi\u00e1 khi ngo\u00e0i b\u1ea3o h\u00e0nh)",
        en: "Opens a ticket for the fault a customer reports, checks the system first, then sends the team the proposed fix and answers the customer (a quote when outside the warranty)",
    },
    version: 11,
    // The old JSON template had `seedActive: true`: the seed makes an ACTIVE workflow from it.
    seedActive: true,
    publishedAt: "2026-11-14T04:15:00.000Z",
    notes: {
        vi: "Nhận tham số của bước gọi trong dữ liệu của sự kiện (trigger.data)",
        en: "Takes its caller's params in the event's data (trigger.data)",
    },
}
/**
 * `webdesk.ticket` version 6 ("Handle an incident"): the front door's hand-off of a fault. Open the ticket of the linked conversation
 * (`intake`), check the system first (`check`), plan the answer (`answer-plan`), tell the team the plan (`team-tell`), answer the customer
 * when there is a conversation (`has-reply` -> `customer-reply`), note the ticket (`ticket-note`), tell the team to link the lead when the
 * customer is linked to no CRM customer (`is-unlinked` -> `link-ask`: the same team-tell step), and end by the check's result
 * (`is-covered`: `in-progress` or `quoted`). A person who declines (a shop's own `ask`) one of the three writes (the ticket's write, the customer's
 * reply, the ticket's note) decided so: that step returns `declined`, the graph tells the team in one notice (`intake-notice`,
 * `reply-notice`, `note-notice`: `team.declined-notice`) and ends `declined`; nothing else runs. Change from version 8: `team-tell` and
 * `link-ask` declined (`team-tell-declined`, `link-ask-declined`, exact booleans) -> outcome `declined` (the declined write is itself a team
 * post, so no notice). Change from version 5: `webdesk.respond-told` is split in one-feature steps, its route is an
 * exact `ifNode` on `covered`; the agent writes, each step makes its one write.
 */
export const webdeskTicketGraph: TemplateGraph = defineTemplateGraph({
    key: WEBDESK_TICKET_KEY,
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({ data: ticketInput }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "agent",
    start: "intake",
    nodes: {
        intake: node(webdeskIntakeLinkedNode, {
            input: {
                text: ref("trigger.data.text"),
                channel: ref("trigger.data.channel"),
                conversationId: ref("trigger.data.conversationId"),
                summary: ref("trigger.data.summary"),
                author: AUTHOR,
                locale: LOCALE,
            },
            next: "intake-declined",
        }),
        "intake-declined": ifNode({
            when: equals(ref("steps.intake.output.declined"), true),
            yes: "intake-notice",
            no: "check",
        }),
        "intake-notice": node(teamDeclinedNoticeNode, {
            input: { step: webdeskCopy("node.intake.title", LOCALE), ref: null, locale: LOCALE },
            next: "declined",
        }),
        check: node(webdeskCheckNode, {
            input: {
                ticketId: ref("steps.intake.output.ticketId"),
                text: ref("trigger.data.text"),
                summary: ref("steps.intake.output.summary"),
                customerCode: ref("steps.intake.output.customerCode"),
                serviceCodes: ref("steps.intake.output.serviceCodes"),
                locale: "vi",
            },
            next: "answer-plan",
        }),
        "answer-plan": node(webdeskAnswerPlanNode, {
            input: {
                ticketId: ref("steps.intake.output.ticketId"),
                conversationId: ref("trigger.data.conversationId"),
                contactId: ref("trigger.data.contactId"),
                customerCode: ref("steps.intake.output.customerCode"),
                summary: ref("steps.intake.output.summary"),
                diagnosis: ref("steps.check.output.diagnosis"),
                covered: ref("steps.check.output.covered"),
                basis: ref("steps.check.output.basis"),
                locale: "vi",
            },
            next: "team-tell",
        }),
        "team-tell": node(webdeskTeamTellNode, {
            input: {
                title: ref("steps.answer-plan.output.team.title"),
                text: ref("steps.answer-plan.output.team.text"),
            },
            next: "team-tell-declined",
        }),
        "team-tell-declined": ifNode({
            when: equals(ref("steps.team-tell.output.declined"), true),
            yes: "declined",
            no: "has-reply",
        }),
        "has-reply": ifNode({
            when: present(ref("steps.answer-plan.output.reply")),
            yes: "customer-reply",
            no: "ticket-note",
        }),
        "customer-reply": node(webdeskCustomerReplyNode, {
            input: { conversationId: ref("trigger.data.conversationId"), text: ref("steps.answer-plan.output.reply") },
            next: "reply-declined",
        }),
        "reply-declined": ifNode({
            when: equals(ref("steps.customer-reply.output.declined"), true),
            yes: "reply-notice",
            no: "ticket-note",
        }),
        "reply-notice": node(teamDeclinedNoticeNode, {
            input: {
                step: webdeskCopy("node.customer-reply.title", LOCALE),
                ref: ref("steps.intake.output.ticketId"),
                locale: LOCALE,
            },
            next: "declined",
        }),
        "ticket-note": node(webdeskTicketNoteNode, {
            input: {
                ticketId: ref("steps.intake.output.ticketId"),
                status: ref("steps.answer-plan.output.status"),
                note: ref("steps.answer-plan.output.note"),
                author: AUTHOR,
            },
            next: "note-declined",
        }),
        "note-declined": ifNode({
            when: equals(ref("steps.ticket-note.output.declined"), true),
            yes: "note-notice",
            no: "is-unlinked",
        }),
        "note-notice": node(teamDeclinedNoticeNode, {
            input: {
                step: webdeskCopy("node.ticket-note.title", LOCALE),
                ref: ref("steps.intake.output.ticketId"),
                locale: LOCALE,
            },
            next: "declined",
        }),
        "is-unlinked": ifNode({
            when: absent(ref("steps.intake.output.customerCode")),
            yes: "link-ask",
            no: "is-covered",
        }),
        "link-ask": node(webdeskTeamTellNode, {
            input: {
                title: ref("steps.answer-plan.output.link.title"),
                text: ref("steps.answer-plan.output.link.text"),
            },
            next: "link-ask-declined",
        }),
        "link-ask-declined": ifNode({
            when: equals(ref("steps.link-ask.output.declined"), true),
            yes: "declined",
            no: "is-covered",
        }),
        "is-covered": ifNode({
            when: equals(ref("steps.check.output.covered"), true),
            yes: "in-progress",
            no: "quoted",
        }),
        "in-progress": outcome({ name: "in-progress", output: { ticketId: ref("steps.intake.output.ticketId") } }),
        quoted: outcome({ name: "quoted", output: { ticketId: ref("steps.intake.output.ticketId") } }),
        declined: outcome({ name: "declined", output: { ticketId: ref("steps.intake.output.ticketId") } }),
    },
})
