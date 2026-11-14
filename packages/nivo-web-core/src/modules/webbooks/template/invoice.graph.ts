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
import { z } from "zod"
import { idSchema } from "../../../nodes/webbooks/books-shapes"
import { webbooksInvoiceDraftNode } from "../../../nodes/webbooks/invoice-draft.node"
import { webbooksInvoiceIssueNode } from "../../../nodes/webbooks/invoice-issue.node"
import { webbooksInvoiceMailNode } from "../../../nodes/webbooks/invoice-mail.node"
import { webbooksInvoiceTeamNode } from "../../../nodes/webbooks/invoice-team.node"
import { webbooksIssueRecordNode } from "../../../nodes/webbooks/issue-record.node"

/** The language the team reads (today's templates fix it). */
const LOCALE = "vi"

/** The fact the engine's team notice names for a declined draft or issue: the service the invoice is for. */
const SERVICE_FACT = { label: { vi: "Mã dịch vụ", en: "Service" }, value: ref("trigger.data.serviceCode") }

/** The graph's contract: what the provider renewal's hand-off passes. */
const input = z.object({
    customerCode: idSchema,
    serviceCode: idSchema,
    renewalId: idSchema,
    termMonths: z.number().int().min(1).max(120),
})

/**
 * `webbooks.invoice` version 12 (Invoice after a renewal), the Accounting agent's primary workflow, reached by the provider
 * renewal's hand-off. `draft` checks the buyer and opens the CRM's draft; `issue` issues it on the MISA meInvoice account on the
 * owner's yes (the ONE `ask` invoice step: a tax document issued in the company's name, a legal signature); `issued` (exact: `outcome`
 * `issued` AND a number present) records the invoice on its draft in the CRM (`record`), then sends it to `mail` (a side step: the
 * customer mail); a rejected issue, or one issued without a number yet, goes straight to `team`. The team is told on every path; the
 * run ends `invoiced` only when the CRM recorded the invoice (`recorded`), else `not-invoiced` after the team line (a person acts). A
 * person who declines the draft or the owner who declines the issue (the legal act) made a decision: it is the step's unsuccessful
 * ending (R68): the ENGINE tells the team (the step, `declined`, the service code) and the run ends `declined`; nothing after it runs. `team` declined (`team-declined`, an exact boolean) -> outcome `declined` (the declined write is itself a team
 * post, so no notice). Change from version 9 (R57): the issue runs on the MISA account (no CRM dry run: a sandbox account replaces it,
 * R56) and answers an outcome; the issued invoice is recorded in the CRM; `invoiced` needs that record. Change from version 10 (R68):
 * the hand-drawn `draft-declined`/`draft-notice` and `issue-declined`/`issue-notice` pairs are the steps' `unsuccessful` option.
 * Change from version 11 (E-R57): `record` writes MISA's own `issuedOn` from the issue's answer (the node's own day only when MISA gave none).
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
        version: 12,
        publishedAt: "2026-11-14T22:00:00.000Z",
        notes: {
            vi: "R68: bản nháp hoặc lần xuất hoá đơn bị từ chối duyệt thì hệ thống tự báo đội kèm mã dịch vụ và kết thúc bị từ chối; quy trình chỉ còn các bước nghiệp vụ",
            en: "R68: a draft or an issue a person declined is told to the team by the engine with the service code and the run ends declined; the workflow keeps only its business steps",
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
            next: "issue",
            unsuccessful: { then: "end", outcome: "declined", facts: [SERVICE_FACT] },
        }),
        // Present on this path (a declined draft ended the run); the step's input takes null and refuses it exactly.
        issue: node(webbooksInvoiceIssueNode, {
            input: {
                draftId: ref("steps.draft.output.draftId", { default: null }),
                renewalId: ref("steps.draft.output.renewalId"),
                locale: LOCALE,
            },
            next: "issued",
            unsuccessful: { then: "end", outcome: "declined", facts: [SERVICE_FACT] },
        }),
        issued: ifNode({
            label: { vi: "Đã xuất hoá đơn có số?", en: "Issued with a number?" },
            when: and(equals(ref("steps.issue.output.outcome"), "issued"), present(ref("steps.issue.output.invoiceNo"))),
            yes: "record",
            no: "team",
        }),
        // Present on this path (`issued` checked them); the step's input takes null and refuses it exactly.
        record: node(webbooksIssueRecordNode, {
            input: {
                draftId: ref("steps.draft.output.draftId", { default: null }),
                invoiceNo: ref("steps.issue.output.invoiceNo", { default: null }),
                invoiceId: ref("steps.issue.output.invoiceId", { default: null }),
                issuedOn: ref("steps.issue.output.issuedOn", { default: null }),
            },
            next: "mail",
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
        // `mail` did not run on the rejected or numberless path (and is skipped without a sending mailbox): its refs default to null.
        team: node(webbooksInvoiceTeamNode, {
            input: {
                renewalId: ref("trigger.data.renewalId"),
                customerCode: ref("trigger.data.customerCode"),
                serviceCode: ref("trigger.data.serviceCode"),
                invoiceNo: ref("steps.issue.output.invoiceNo", { default: null }),
                outcome: ref("steps.issue.output.outcome", { default: null }),
                refusal: ref("steps.issue.output.refusal", { default: null }),
                messageRef: ref("steps.mail.output.messageRef", { default: null }),
                mailRefusal: ref("steps.mail.output.refusal", { default: null }),
                locale: LOCALE,
            },
            next: "team-declined",
        }),
        // A person declined the team post: the post was the team's own, so no notice; the run ends `declined`.
        "team-declined": ifNode({
            label: { vi: "Bị từ chối báo đội?", en: "Team post declined?" },
            when: equals(ref("steps.team.output.declined"), true),
            yes: "declined",
            no: "recorded",
        }),
        // `record` did not run on the rejected or numberless path: its ref defaults to null and the run ends `not-invoiced`.
        recorded: ifNode({
            label: { vi: "CRM đã ghi hoá đơn?", en: "Recorded in the CRM?" },
            when: equals(ref("steps.record.output.recorded", { default: null }), true),
            yes: "invoiced",
            no: "not-invoiced",
        }),
        invoiced: outcome({ name: "invoiced", label: { vi: "Đã xuất hoá đơn", en: "Invoiced" }, output: { renewalId: ref("trigger.data.renewalId") } }),
        "not-invoiced": outcome({
            name: "not-invoiced",
            label: { vi: "Chưa xuất được hoá đơn", en: "Not invoiced" },
            output: {
                renewalId: ref("trigger.data.renewalId"),
                outcome: ref("steps.issue.output.outcome", { default: null }),
                refusal: ref("steps.issue.output.refusal", { default: null }),
            },
        }),
        declined: outcome({ name: "declined", label: { vi: "Bị từ chối", en: "Declined" }, output: { renewalId: ref("trigger.data.renewalId") } }),
    },
})
