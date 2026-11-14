import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    defineTemplateGraph,
    endItem,
    equals,
    loop,
    ifNode,
    item,
    node,
    outcome,
    present,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { teamDeclinedNoticeNode } from "@nivo-lite/blocks-core"
import { z } from "zod"
import { webdeskCheckNode } from "../../../nodes/webdesk/check.node"
import { webdeskContactLinkNode } from "../../../nodes/webdesk/contact-link.node"
import { ID_MAX } from "../../../nodes/webdesk/desk-shapes"
import { webdeskIdentifyNode } from "../../../nodes/webdesk/identify.node"
import { webdeskMailReplyDraftNode } from "../../../nodes/webdesk/mail-reply-draft.node"
import { webdeskPlanNode } from "../../../nodes/webdesk/plan.node"
import { webdeskTeamTellNode } from "../../../nodes/webdesk/team-tell.node"
import { webdeskTicketNoteNode } from "../../../nodes/webdesk/ticket-note.node"
import { webdeskTicketOpenNode } from "../../../nodes/webdesk/ticket-open.node"
import { webdeskCopy } from "../copy"

/** The key of the mailed-tickets workflow of the Support agent. */
export const WEBDESK_MAIL_TICKETS_KEY = "webdesk.mail-tickets"

/** The most mails one call hands over (the Mailbox round's own most), and the loop's cap (`loop({ max })`). */
const MAILS_MAX = 25

/** One mail as the Mailbox's hand-off passes it (`webmail.sorted-report` `tickets`), with the customer when a caller knows it. */
const handedMail = z.object({
    mailId: z.string().min(1).max(ID_MAX),
    mailbox: z.string().min(1).max(ID_MAX),
    from: z.string().max(400),
    subject: z.string().max(400),
    summary: z.string().min(1).max(400),
    customerCode: z.string().min(1).max(ID_MAX).nullish(),
})

/** The graph's contract: the mails to open tickets for. */
const mailTicketsInput = z.object({ mails: z.array(handedMail).min(1).max(MAILS_MAX) })

/** The name the steps write their ticket notes under: the agent's label as the team reads it. */
const AUTHOR = webdeskCopy("agent.label", "vi")

/** The language of the graph's steps (the team reads Vietnamese): the declined notices name their step in it. */
const LOCALE = "vi"

/** What the template catalogue shows of version 5: the texts of version 4, the change note of 5 (rights: one mode per node). */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "Phi\u1ebfu t\u1eeb h\u1ed9p th\u01b0", en: "Tickets from the mailbox" },
    summary: {
        vi: "H\u1ed9p th\u01b0 chuy\u1ec3n c\u00e1c th\u01b0 kh\u00e1ch b\u00e1o l\u1ed7i: m\u1ed7i th\u01b0 \u0111\u01b0\u1ee3c m\u1edf phi\u1ebfu, ki\u1ec3m tra h\u1ec7 th\u1ed1ng tr\u01b0\u1edbc, r\u1ed3i b\u00e1o \u0111\u1ed9i c\u00e1ch s\u1eeda v\u00e0 so\u1ea1n th\u01b0 tr\u1ea3 l\u1eddi g\u1eedi kh\u00e1ch",
        en: "The Mailbox hands on the customers' fault mails: each gets a ticket and a system check, then the team gets the proposed fix and a drafted reply mail",
    },
    version: 8,
    // The old JSON template had `seedActive: true`: the seed makes an ACTIVE workflow from it.
    seedActive: true,
    publishedAt: "2026-11-14T04:15:00.000Z",
    notes: {
        vi: "Nhận tham số của bước gọi trong dữ liệu của sự kiện (trigger.data)",
        en: "Takes its caller's params in the event's data (trigger.data)",
    },
}

/**
 * `webdesk.mail-tickets` version 4 ("Tickets from the mailbox"): the Mailbox agent hands on the customers' fault mails; for EACH mail
 * (keyed by its `mailId`): identify the customer (`identify`), link the sender's address when the customer was found by another fact
 * (`has-link` -> `contact-link`, a side step), open the ticket or note an open one (`ticket-open`), check the system first (`check`),
 * plan (`plan`), tell the team the plan (`team-tell`), hand the mail reply to a person when there is a sender to answer (`has-reply` ->
 * `mail-reply-draft`, a side step), and note the ticket (`ticket-note`, what the loop collects). Change from version 3: the body's
 * `webdesk.intake` and `webdesk.mail-plan` are split in one-feature steps; the `send_email` work item is the mail send tool. A person
 * who declines (a shop's own `ask`) one of the two blocking writes of an item (the ticket's write, the ticket's note) decided so: the step returns
 * `declined`, the graph tells the team in one notice of the item (`open-notice`, `note-notice`: `team.declined-notice`, `scope: "item"`)
 * and THAT ITEM ends there (no
 * `no` route); the round goes on. The loop collects `ticket-note`: an item whose note a person declined says `declined: true`, an item whose
 * ticket a person declined reads null (the note never ran; every other stop of an item stops the run), and the outcome `opened` hands
 * the collected items on (`tickets`). Change from version 6: `team-tell` declined (`team-tell-declined`, an exact boolean; the items are
 * independent) -> its item ends (the declined write is itself a team post, so no notice); the round goes on.
 */
export const webdeskMailTicketsGraph: TemplateGraph = defineTemplateGraph({
    key: WEBDESK_MAIL_TICKETS_KEY,
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({ data: mailTicketsInput }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "each",
    nodes: {
        each: loop({
            over: ref("trigger.data.mails"),
            key: "mailId",
            concurrency: 1,
            max: MAILS_MAX,
            body: {
                start: "identify",
                collect: "ticket-note",
                nodes: {
                    identify: node(webdeskIdentifyNode, {
                        input: {
                            text: item("summary"),
                            from: item("from"),
                            subject: item("subject"),
                            customerCode: item("customerCode"),
                            locale: "vi",
                        },
                        next: "has-link",
                    }),
                    "has-link": ifNode({
                        when: present(ref("steps.identify.output.linkAddress")),
                        yes: "contact-link",
                        no: "ticket-open",
                    }),
                    "contact-link": node(webdeskContactLinkNode, {
                        input: {
                            customerCode: ref("steps.identify.output.customerCode"),
                            address: ref("steps.identify.output.linkAddress"),
                        },
                        next: "ticket-open",
                    }),
                    "ticket-open": node(webdeskTicketOpenNode, {
                        input: {
                            text: item("summary"),
                            channel: "email",
                            sourceRef: item("mailId"),
                            customerCode: ref("steps.identify.output.customerCode"),
                            serviceCodes: ref("steps.identify.output.serviceCodes"),
                            author: AUTHOR,
                            locale: LOCALE,
                        },
                        next: "open-declined",
                    }),
                    // Declined: no `no`, so the ITEM ends after its notice; the round goes on.
                    "open-declined": ifNode({
                        when: equals(ref("steps.ticket-open.output.declined"), true),
                        yes: "open-notice",
                        no: "check",
                    }),
                    "open-notice": node(teamDeclinedNoticeNode, {
                        input: {
                            step: webdeskCopy("node.intake.title", LOCALE),
                            ref: item("mailId"),
                            locale: LOCALE,
                            scope: "item",
                        },
                    }),
                    check: node(webdeskCheckNode, {
                        input: {
                            ticketId: ref("steps.ticket-open.output.ticketId"),
                            text: item("summary"),
                            summary: ref("steps.ticket-open.output.summary"),
                            customerCode: ref("steps.ticket-open.output.customerCode"),
                            serviceCodes: ref("steps.ticket-open.output.serviceCodes"),
                            locale: "vi",
                        },
                        next: "plan",
                    }),
                    plan: node(webdeskPlanNode, {
                        input: {
                            ticketId: ref("steps.ticket-open.output.ticketId"),
                            customerCode: ref("steps.ticket-open.output.customerCode"),
                            mailId: item("mailId"),
                            from: item("from"),
                            subject: item("subject"),
                            summary: ref("steps.ticket-open.output.summary"),
                            diagnosis: ref("steps.check.output.diagnosis"),
                            covered: ref("steps.check.output.covered"),
                            basis: ref("steps.check.output.basis"),
                            locale: "vi",
                        },
                        next: "team-tell",
                    }),
                    "team-tell": node(webdeskTeamTellNode, {
                        input: { title: ref("steps.plan.output.team.title"), text: ref("steps.plan.output.team.text") },
                        next: "team-tell-declined",
                    }),
                    // A person declined the team post: only this item ends (no notice, the post was the team's own); the round goes on.
                    "team-tell-declined": ifNode({
                        when: equals(ref("steps.team-tell.output.declined"), true),
                        yes: endItem,
                        no: "has-reply",
                    }),
                    "has-reply": ifNode({
                        when: present(ref("steps.plan.output.reply")),
                        yes: "mail-reply-draft",
                        no: "ticket-note",
                    }),
                    "mail-reply-draft": node(webdeskMailReplyDraftNode, {
                        input: {
                            to: item("from"),
                            reply: ref("steps.plan.output.reply"),
                            ticketId: ref("steps.ticket-open.output.ticketId"),
                        },
                        next: "ticket-note",
                    }),
                    "ticket-note": node(webdeskTicketNoteNode, {
                        input: {
                            ticketId: ref("steps.ticket-open.output.ticketId"),
                            status: ref("steps.plan.output.status"),
                            note: ref("steps.plan.output.note"),
                            author: AUTHOR,
                        },
                        next: "note-declined",
                    }),
                    // Declined: the item ends after its notice (no `no` either way: the note is the item's last step).
                    "note-declined": ifNode({
                        when: equals(ref("steps.ticket-note.output.declined"), true),
                        yes: "note-notice",
                    }),
                    "note-notice": node(teamDeclinedNoticeNode, {
                        input: {
                            step: webdeskCopy("node.ticket-note.title", LOCALE),
                            ref: ref("steps.ticket-note.output.ticketId"),
                            locale: LOCALE,
                            scope: "item",
                        },
                    }),
                },
            },
            next: "opened",
        }),
        opened: outcome({ name: "opened", output: { tickets: ref("steps.each.output.items") } }),
    },
})
