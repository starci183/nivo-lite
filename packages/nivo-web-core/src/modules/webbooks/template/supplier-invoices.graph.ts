import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    defineTemplateGraph,
    equals,
    ifNode,
    item,
    loop,
    node,
    outcome,
    present,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { supplierMailSchema, webbooksSupplierCheckNode } from "../../../nodes/webbooks/supplier-check.node"
import { webbooksSupplierNoteNode } from "../../../nodes/webbooks/supplier-note.node"
import { webbooksSupplierReportNode } from "../../../nodes/webbooks/supplier-report.node"

/** The language the team reads (today's templates fix it). */
const LOCALE = "vi"

/**
 * The most mails one hand-off carries; past the loop's cap of 50 the rest are counted in the loop's `held` and told to the team.
 */
const MAILS_MAX = 200

/** The graph's contract: the supplier-invoice mails the Mailbox agent hands on. */
const input = z.object({ mails: z.array(supplierMailSchema).max(MAILS_MAX) })

/**
 * `webbooks.supplier-invoices` version 8 (Check supplier invoices), reached by the Mailbox agent's hand-off. An empty hand-off
 * ends at once (`any-mail`, an exact emptiness check; today the report step chose to post nothing). Each mail runs a body:
 * `check` (reads only), then `note`, which takes what the check found whole: a matched invoice is noted on its payable, an
 * unmatched one is not (an exact boolean, in the step). A note a person declined is the note step's unsuccessful ending (R68): the
 * ENGINE tells the team (the step, `declined`, the invoice number) and its item ends; the round goes on. The loop collects `note`, which every item
 * reaches: the report needs the unmatched ones (what a person must look at), the noted ones and the declined ones.
 * Change from version 5: `report` declined (`report-declined`, an exact boolean) -> outcome `declined` (the declined write is itself a team
 * post, so no notice). Change from version 7 (R68): the hand-drawn `note-declined`/`note-notice` pair is the note step's
 * `unsuccessful` option (same item end, same team notice facts).
 */
export const supplierInvoicesGraph: TemplateGraph = defineTemplateGraph({
    key: "webbooks.supplier-invoices",
    title: { vi: "\u0110\u1ed1i chi\u1ebfu ho\u00e1 \u0111\u01a1n nh\u00e0 cung c\u1ea5p", en: "Check supplier invoices" },
    input: z.object({ data: input }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "any-mail",
    catalogue: {
        name: { vi: "\u0110\u1ed1i chi\u1ebfu ho\u00e1 \u0111\u01a1n nh\u00e0 cung c\u1ea5p", en: "Check supplier invoices" },
        summary: {
            vi: "Khi H\u1ed9p th\u01b0 chuy\u1ec3n c\u00e1c th\u01b0 ho\u00e1 \u0111\u01a1n nh\u00e0 cung c\u1ea5p: \u0111\u1ed1i chi\u1ebfu t\u1eebng ho\u00e1 \u0111\u01a1n v\u1edbi ho\u00e1 \u0111\u01a1n \u0111i\u1ec7n t\u1eed \u0111\u00e3 nh\u1eadn v\u00e0 c\u00f4ng n\u1ee3 ph\u1ea3i tr\u1ea3, ghi ch\u00fa ho\u00e1 \u0111\u01a1n kh\u1edbp, b\u00e1o \u0111\u1ed9i ho\u00e1 \u0111\u01a1n c\u1ea7n ng\u01b0\u1eddi xem",
            en: "When the Mailbox agent hands on supplier-invoice mails: checks each against the received e-invoices and the payables, notes the matched ones, tells the team which need a person",
        },
        version: 8,
        publishedAt: "2026-11-14T22:00:00.000Z",
        notes: {
            vi: "R68: ghi chú hoá đơn bị từ chối duyệt thì hệ thống tự báo đội kèm số hoá đơn, vòng đối chiếu vẫn tiếp tục; quy trình chỉ còn các bước nghiệp vụ",
            en: "R68: a note a person declined is told to the team by the engine with the invoice number and the round goes on; the workflow keeps only its business steps",
        },
    },
    nodes: {
        "any-mail": ifNode({
            label: { vi: "Có thư hoá đơn nào?", en: "Any invoice mail?" },
            when: present(ref("trigger.data.mails")),
            yes: "each",
            no: "checked",
        }),
        each: loop({
            label: { vi: "Từng thư hoá đơn nhà cung cấp", en: "Each supplier-invoice mail" },
            over: ref("trigger.data.mails"),
            key: "mailId",
            concurrency: 1,
            body: {
                start: "check",
                collect: "note",
                nodes: {
                    check: node(webbooksSupplierCheckNode, {
                        input: {
                            mailId: item("mailId"),
                            from: item("from"),
                            subject: item("subject"),
                            summary: item("summary"),
                            locale: LOCALE,
                        },
                        next: "note",
                    }),
                    // What the check found, whole: the step notes a matched invoice only (present when matched, the check's own
                    // schema says so; the step's input takes null and refuses it exactly).
                    note: node(webbooksSupplierNoteNode, {
                        input: {
                            mailId: ref("steps.check.output.mailId"),
                            matched: ref("steps.check.output.matched"),
                            partyCode: ref("steps.check.output.partyCode", { default: null }),
                            einvoiceRef: ref("steps.check.output.einvoiceRef", { default: null }),
                            invoiceNo: ref("steps.check.output.invoiceNo", { default: null }),
                            issuedOn: ref("steps.check.output.issuedOn", { default: null }),
                            note: ref("steps.check.output.note", { default: null }),
                            why: ref("steps.check.output.why"),
                        },
                        // The item ends here either way (`next` absent). A person declined the note: the engine tells the team (R68,
                        // the invoice number) and the round goes on (`continue`, a loop body's default).
                        unsuccessful: {
                            then: "continue",
                            facts: [{ label: { vi: "Số hoá đơn", en: "Invoice" }, value: ref("steps.check.output.invoiceNo", { default: null }) }],
                        },
                    }),
                },
            },
            next: "report",
        }),
        report: node(webbooksSupplierReportNode, {
            input: { items: ref("steps.each.output.items"), held: ref("steps.each.output.held"), locale: LOCALE },
            next: "report-declined",
        }),
        // A person declined the team report: the report was the team's own post, so no notice; the run ends `declined`.
        "report-declined": ifNode({
            label: { vi: "Bị từ chối báo cáo?", en: "Report declined?" },
            when: equals(ref("steps.report.output.declined"), true),
            yes: "declined",
            no: "checked",
        }),
        checked: outcome({ name: "checked", label: { vi: "Đã đối chiếu", en: "Checked" } }),
        declined: outcome({ name: "declined", label: { vi: "Bị từ chối", en: "Declined" } }),
    },
})
