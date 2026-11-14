import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    callWorkflows,
    defineTemplateGraph,
    equals,
    gt,
    ifNode,
    item,
    loop,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { ROUND_MAILS_MAX } from "../../../nodes/webmail/mail-shapes"
import { webmailReadNode } from "../../../nodes/webmail/read.node"
import { webmailSortNode } from "../../../nodes/webmail/sort.node"
import { webmailSortedReportNode } from "../../../nodes/webmail/sorted-report.node"

/** The key of the Mailbox agent's mail round. */
export const WEBMAIL_TRIAGE_KEY = "webmail.triage"

/** The clock preset of the round (the catalogue's `every_15m`, today's `WEBMAIL_TEMPLATE.triggers`). */
const ROUND_PRESET = "every_15m"

/** The graph's contract: every input optional (the clock supplies none; new mail supplies its event ids and count), as in version 3. */
const triageInput = z.object({
    eventIds: z.array(z.string().min(1).max(200)).max(100).nullish(),
    count: z.number().int().min(0).nullish(),
})

/** What the template catalogue shows of version 5: the texts of version 4, the change note of 5 (rights: one mode per node). */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "\u0110\u1ecdc th\u01b0 m\u1edbi", en: "Read new mail" },
    summary: {
        vi: "M\u1ed7i 15 ph\u00fat \u0111\u1ecdc th\u01b0 m\u1edbi c\u1ee7a c\u00e1c h\u1ed9p th\u01b0 \u0111\u01b0\u1ee3c g\u1eafn v\u00e0 b\u00e1o \u0111\u1ed9i trong /chat nh\u1eefng th\u01b0 c\u1ea7n ng\u01b0\u1eddi x\u1eed l\u00fd",
        en: "Every 15 minutes reads the new mail of the attached mailboxes and tells the team in /chat which mails need a person",
    },
    version: 6,
    publishedAt: "2026-11-14T01:00:00.000Z",
    notes: {
        vi: "Ng\u01b0\u1eddi t\u1eeb ch\u1ed1i b\u00e0i b\u00e1o \u0111\u1ed9i c\u1ee7a v\u00f2ng th\u01b0 th\u00ec k\u1ebft th\u00fac v\u1edbi k\u1ebft qu\u1ea3 declined (kh\u00f4ng c\u00f3 th\u00f4ng b\u00e1o ri\u00eang, v\u00ec ch\u00ednh b\u00e0i \u0111\u0103ng l\u00e0 b\u00e0i c\u1ee7a \u0111\u1ed9i)",
        en: "A person declining the round report to the team ends the run `declined` (no extra notice: the declined write is itself a team post)",
    },
}

/**
 * `webmail.triage` version 4 ("Read new mail"): every 15 minutes, and on new mail of any attached IMAP mailbox, fetch the new mail
 * (`read`, a plain tool call); end at once when there is none (`has-mail`: `count > 0`, an exact check); sort each mail (`each`, keyed
 * by the mail's id); tell the team which mails need a person and group the rest by kind (`report`); hand each non-empty list to the
 * agent that handles it in ONE step (`hand-offs`: renewal replies -> Renewals, support requests -> Support, supplier invoices ->
 * Accounting, enquiries -> Sales; a call is skipped when its list is empty); end `sorted` with the four lists. Change from version 3:
 * `webmail.read` calls the list without an AI; the four `core.if` + `core.call-workflow` pairs are one `callWorkflows`; the hand-offs
 * run BEFORE the outcome (an outcome ends its branch in the builder). Change from version 5: `report` declined (`report-declined`, an exact
 * boolean) -> outcome `declined` (the declined write is itself a team post, so no notice); no hand-off runs after it.
 */
export const webmailTriageGraph: TemplateGraph = defineTemplateGraph({
    key: WEBMAIL_TRIAGE_KEY,
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: triageInput,
    triggers: [
        trigger(TRIGGER.clockTick, { args: { preset: ROUND_PRESET } }),
        // Every attached mailbox is a source (cto@, ketoan@, support@: three streams).
        trigger(TRIGGER.mailMessageReceived, { accounts: [PROVIDER.imap] }),
    ],
    openTo: "agent",
    start: "read",
    nodes: {
        read: node(webmailReadNode, { input: {}, next: "has-mail" }),
        "has-mail": ifNode({
            when: gt(ref("steps.read.output.count"), 0),
            yes: "each",
            no: "empty",
        }),
        each: loop({
            over: ref("steps.read.output.mails"),
            key: "id",
            concurrency: 1,
            max: ROUND_MAILS_MAX,
            body: {
                start: "sort",
                collect: "sort",
                nodes: {
                    sort: node(webmailSortNode, {
                        input: {
                            id: item("id"),
                            mailbox: item("mailbox"),
                            from: item("from"),
                            subject: item("subject"),
                            snippet: item("snippet"),
                            hasAttachments: item("hasAttachments"),
                            locale: "vi",
                        },
                    }),
                },
            },
            next: "report",
        }),
        report: node(webmailSortedReportNode, {
            input: { items: ref("steps.each.output.items"), held: ref("steps.each.output.held"), locale: "vi" },
            next: "report-declined",
        }),
        "report-declined": ifNode({
            when: equals(ref("steps.report.output.declined"), true),
            yes: "declined",
            no: "hand-offs",
        }),
        "hand-offs": callWorkflows({
            calls: [
                {
                    agent: "webrenew",
                    workflow: "mail-replies",
                    when: ref("steps.report.output.renewals"),
                    input: { mails: ref("steps.report.output.renewals") },
                },
                {
                    agent: "webdesk",
                    workflow: "mail-tickets",
                    when: ref("steps.report.output.tickets"),
                    input: { mails: ref("steps.report.output.tickets") },
                },
                {
                    agent: "webbooks",
                    workflow: "supplier-invoices",
                    when: ref("steps.report.output.invoices"),
                    input: { mails: ref("steps.report.output.invoices") },
                },
                {
                    agent: "websales",
                    workflow: "mail-enquiries",
                    when: ref("steps.report.output.enquiries"),
                    input: { mails: ref("steps.report.output.enquiries") },
                },
            ],
            next: "sorted",
        }),
        sorted: outcome({
            name: "sorted",
            output: {
                renewals: ref("steps.report.output.renewals"),
                tickets: ref("steps.report.output.tickets"),
                invoices: ref("steps.report.output.invoices"),
                enquiries: ref("steps.report.output.enquiries"),
            },
        }),
        empty: outcome({ name: "empty" }),
        declined: outcome({ name: "declined" }),
    },
})
