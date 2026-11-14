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

/** What the template catalogue shows of version 9: the texts of version 4, the change note of 9 (R68). */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "Phi\u1ebfu t\u1eeb h\u1ed9p th\u01b0", en: "Tickets from the mailbox" },
    summary: {
        vi: "H\u1ed9p th\u01b0 chuy\u1ec3n c\u00e1c th\u01b0 kh\u00e1ch b\u00e1o l\u1ed7i: m\u1ed7i th\u01b0 \u0111\u01b0\u1ee3c m\u1edf phi\u1ebfu, ki\u1ec3m tra h\u1ec7 th\u1ed1ng tr\u01b0\u1edbc, r\u1ed3i b\u00e1o \u0111\u1ed9i c\u00e1ch s\u1eeda v\u00e0 so\u1ea1n th\u01b0 tr\u1ea3 l\u1eddi g\u1eedi kh\u00e1ch",
        en: "The Mailbox hands on the customers' fault mails: each gets a ticket and a system check, then the team gets the proposed fix and a drafted reply mail",
    },
    version: 9,
    // The old JSON template had `seedActive: true`: the seed makes an ACTIVE workflow from it.
    seedActive: true,
    publishedAt: "2026-11-14T22:00:00.000Z",
    notes: {
        vi: "R68: mở phiếu hoặc ghi chú phiếu bị từ chối duyệt thì hệ thống tự báo đội kèm mã thư hoặc mã phiếu, thư đó dừng, vòng vẫn tiếp tục; quy trình chỉ còn các bước nghiệp vụ",
        en: "R68: a ticket write or note a person declined is told to the team by the engine with the mail or the ticket, that mail stops and the round goes on; the workflow keeps only its business steps",
    },
}

/**
 * `webdesk.mail-tickets` version 9 ("Tickets from the mailbox"): the Mailbox agent hands on the customers' fault mails; for EACH mail
 * (keyed by its `mailId`): identify the customer (`identify`), link the sender's address when the customer was found by another fact
 * (`has-link` -> `contact-link`, a side step), open the ticket or note an open one (`ticket-open`), check the system first (`check`),
 * plan (`plan`), tell the team the plan (`team-tell`), hand the mail reply to a person when there is a sender to answer (`has-reply` ->
 * `mail-reply-draft`, a side step), and note the ticket (`ticket-note`, what the loop collects). Change from version 3: the body's
 * `webdesk.intake` and `webdesk.mail-plan` are split in one-feature steps; the `send_email` work item is the mail send tool. A person
 * who declines (a shop's own `ask`) one of the two blocking writes of an item (the ticket's write, the ticket's note) decided so: the step returns
 * `declined`; it is the step's unsuccessful ending (R68): the ENGINE tells the team (the step, `declined`, the mail or the ticket)
 * and THAT ITEM ends there (`open-declined` ends it after a declined ticket write; the note is the item's last step); the round goes on. The loop collects `ticket-note`: an item whose note a person declined says `declined: true`, an item whose
 * ticket a person declined reads null (the note never ran; every other stop of an item stops the run), and the outcome `opened` hands
 * the collected items on (`tickets`). Change from version 6: `team-tell` declined (`team-tell-declined`, an exact boolean; the items are
 * independent) -> its item ends (the declined write is itself a team post, so no notice); the round goes on. Change from version 8
 * (R68): the hand-drawn `open-notice` and `note-declined`/`note-notice` are the steps' `unsuccessful` option (`open-declined` stays: the
 * item cannot go on without its ticket).
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
            label: { vi: "Từng thư báo lỗi", en: "Each fault mail" },
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
                        label: { vi: "Cần gắn địa chỉ thư cho khách?", en: "Link the sender's address?" },
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
                        // A person declined the ticket's write: the engine tells the team (R68, the mail) and the item goes on to
                        // `open-declined` (`continue`, a loop body's default), which ends it.
                        unsuccessful: { then: "continue", facts: [{ label: { vi: "Mã thư", en: "Mail" }, value: item("mailId") }] },
                    }),
                    // Declined: no ticket to check, so the ITEM ends (business: the steps after it need the ticket); the round goes on.
                    "open-declined": ifNode({
                        label: { vi: "Bị từ chối mở phiếu?", en: "Ticket write declined?" },
                        when: equals(ref("steps.ticket-open.output.declined"), true),
                        yes: endItem,
                        no: "check",
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
                        label: { vi: "Bị từ chối báo đội?", en: "Team line declined?" },
                        when: equals(ref("steps.team-tell.output.declined"), true),
                        yes: endItem,
                        no: "has-reply",
                    }),
                    "has-reply": ifNode({
                        label: { vi: "Có thư trả lời khách?", en: "A reply to mail?" },
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
                        // The note is the item's last step (`next` absent). A person declined it: the engine tells the team (R68, the
                        // ticket) and the round goes on (`continue`, a loop body's default).
                        unsuccessful: {
                            then: "continue",
                            facts: [{ label: { vi: "Mã phiếu", en: "Ticket" }, value: ref("steps.ticket-open.output.ticketId") }],
                        },
                    }),
                },
            },
            next: "opened",
        }),
        opened: outcome({ name: "opened", label: { vi: "Đã mở phiếu", en: "Tickets opened" }, output: { tickets: ref("steps.each.output.items") } }),
    },
})
