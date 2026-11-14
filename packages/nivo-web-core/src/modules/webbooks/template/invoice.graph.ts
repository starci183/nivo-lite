import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    and,
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
import { idSchema } from "../../../nodes/webbooks/books-shapes"
import { webbooksInvoiceDraftNode } from "../../../nodes/webbooks/invoice-draft.node"
import { webbooksInvoiceIssueNode } from "../../../nodes/webbooks/invoice-issue.node"
import { webbooksInvoiceMailNode } from "../../../nodes/webbooks/invoice-mail.node"
import { webbooksInvoiceTeamNode } from "../../../nodes/webbooks/invoice-team.node"
import { webbooksText } from "../copy"

/** The language the team reads (today's templates fix it). */
const LOCALE = "vi"

/** The graph's contract: what the provider renewal's hand-off passes. */
const input = z.object({
    customerCode: idSchema,
    serviceCode: idSchema,
    renewalId: idSchema,
    termMonths: z.number().int().min(1).max(120),
})

/**
 * `webbooks.invoice` version 5 (Invoice after a renewal), the Accounting agent's primary workflow, reached by the provider
 * renewal's hand-off. `draft` checks the buyer and opens the CRM's draft; `issue` issues it on the owner's yes (the ONE `ask` step of the package: a tax document issued in the company's name, a legal signature); `issued` (exact:
 * `dryRun` false AND a number present) sends a real invoice to `mail` (a side step: the customer mail), a dry
 * run straight to `team`; the team is told on both paths, then `invoiced`. A person who declines the draft (`draft-declined`) or the
 * owner who declines the issue (`issue-declined`, the legal act), both exact booleans, made a decision: the team is told
 * (`draft-notice` / `issue-notice`, `team.declined-notice`) and the run ends `declined`; nothing after it runs (no issue, no mail,
 * no team report). Version 5 (flipDecisions2026_11_13): `issue` names the CRM source for the invoice purpose, so the graph is hidden
 * (`tool_unavailable`) until an attached CRM account's PINNED document marks `nivo.tool.invoice.create`.
 * Change from version 7: `team` declined (`team-declined`, an exact boolean) -> outcome `declined` (the declined write is itself a team post,
 * so no notice; it is the last step, nothing after it runs).
 */
export const invoiceGraph: TemplateGraph = defineTemplateGraph({
    key: "webbooks.invoice",
    title: { vi: "Xu\u1ea5t ho\u00e1 \u0111\u01a1n sau gia h\u1ea1n", en: "Invoice after a renewal" },
    input: z.object({ data: input }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "draft",
    catalogue: {
        name: { vi: "Xu\u1ea5t ho\u00e1 \u0111\u01a1n sau gia h\u1ea1n", en: "Invoice after a renewal" },
        summary: {
            vi: "Sau khi gia h\u1ea1n t\u1ea1i nh\u00e0 cung c\u1ea5p: so\u1ea1n ho\u00e1 \u0111\u01a1n t\u1eeb CRM, xu\u1ea5t ho\u00e1 \u0111\u01a1n khi ch\u1ee7 duy\u1ec7t, so\u1ea1n th\u01b0 g\u1eedi kh\u00e1ch v\u00e0 b\u00e1o \u0111\u1ed9i",
            en: "After the provider renewal: drafts the invoice in the CRM, issues it when the owner approves, drafts the customer mail and tells the team",
        },
        version: 9,
        publishedAt: "2026-11-14T04:15:00.000Z",
        notes: {
            vi: "Nhận tham số của bước gọi trong dữ liệu của sự kiện (trigger.data)",
            en: "Takes its caller's params in the event's data (trigger.data)",
        },
    },
    nodes: {
        draft: node(webbooksInvoiceDraftNode, {
            input: {
                renewalId: ref("trigger.data.renewalId"),
                customerCode: ref("trigger.data.customerCode"),
                serviceCode: ref("trigger.data.serviceCode"),
                termMonths: ref("trigger.data.termMonths"),
                locale: LOCALE,
            },
            next: "draft-declined",
        }),
        "draft-declined": ifNode({
            when: equals(ref("steps.draft.output.declined"), true),
            yes: "draft-notice",
            no: "issue",
        }),
        "draft-notice": node(teamDeclinedNoticeNode, {
            input: {
                step: webbooksText("node.invoice-draft.title").vi,
                ref: ref("trigger.data.serviceCode"),
                locale: LOCALE,
            },
            next: "declined",
        }),
        // Present on this path (`draft-declined` checked it); the step's input takes null and refuses it exactly.
        issue: node(webbooksInvoiceIssueNode, {
            input: {
                draftId: ref("steps.draft.output.draftId", { default: null }),
                renewalId: ref("steps.draft.output.renewalId"),
                locale: LOCALE,
            },
            next: "issue-declined",
        }),
        "issue-declined": ifNode({
            when: equals(ref("steps.issue.output.declined"), true),
            yes: "issue-notice",
            no: "issued",
        }),
        "issue-notice": node(teamDeclinedNoticeNode, {
            input: {
                step: webbooksText("node.invoice-issue.title").vi,
                ref: ref("trigger.data.serviceCode"),
                locale: LOCALE,
            },
            next: "declined",
        }),
        issued: ifNode({
            when: and(equals(ref("steps.issue.output.dryRun"), false), present(ref("steps.issue.output.invoiceNo"))),
            yes: "mail",
            no: "team",
        }),
        mail: node(webbooksInvoiceMailNode, {
            input: {
                renewalId: ref("trigger.data.renewalId"),
                customerCode: ref("trigger.data.customerCode"),
                draftId: ref("steps.draft.output.draftId", { default: null }),
                // Present on this path (`issued` checked it); the step's input takes null and refuses it exactly.
                invoiceNo: ref("steps.issue.output.invoiceNo", { default: null }),
                locale: LOCALE,
            },
            next: "team",
        }),
        // `mail` did not run on the dry-run path (and is skipped without a sending mailbox): its refs default to null.
        team: node(webbooksInvoiceTeamNode, {
            input: {
                renewalId: ref("trigger.data.renewalId"),
                customerCode: ref("trigger.data.customerCode"),
                serviceCode: ref("trigger.data.serviceCode"),
                invoiceNo: ref("steps.issue.output.invoiceNo", { default: null }),
                dryRun: ref("steps.issue.output.dryRun", { default: null }),
                messageRef: ref("steps.mail.output.messageRef", { default: null }),
                mailRefusal: ref("steps.mail.output.refusal", { default: null }),
                locale: LOCALE,
            },
            next: "team-declined",
        }),
        // A person declined the team post: the post was the team's own, so no notice; the run ends `declined`.
        "team-declined": ifNode({
            when: equals(ref("steps.team.output.declined"), true),
            yes: "declined",
            no: "invoiced",
        }),
        invoiced: outcome({ name: "invoiced", output: { renewalId: ref("trigger.data.renewalId") } }),
        declined: outcome({ name: "declined", output: { renewalId: ref("trigger.data.renewalId") } }),
    },
})
