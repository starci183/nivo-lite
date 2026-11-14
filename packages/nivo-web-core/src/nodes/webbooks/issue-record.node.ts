import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webbooksText } from "../../modules/webbooks/copy"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { idSchema, jsonText } from "./books-shapes"
import { crmOk, refused } from "./books.fixtures"

/**
 * The draft and the invoice the e-invoice service issued for it. The graph reaches this step only for an issued invoice with a number
 * (`issued` checks both), but a branch does not narrow a ref: the draft id and the number are typed nullable and a null one is
 * refused exactly. The service's id is kept as the CRM's provider reference when given.
 */
const input = z.object({
    draftId: idSchema.nullable(),
    invoiceNo: z.string().min(1).max(40).nullable(),
    invoiceId: z.string().min(1).max(200).nullable(),
    issuedOn: z.string().max(10).nullable(),
})

/** Whether the CRM recorded the issued invoice on its draft, and the draft's state after it. */
const output = z.object({
    recorded: z.boolean().describe("True once the CRM recorded the issued invoice on its draft; false when a person declined the write."),
    state: z.string().min(1).max(40).nullable().describe("The draft's `state` as the CRM answered it; null when nothing was written."),
})

const DRAFT_ID = "6c1a4d2f-3e5b-4f7c-9d8e-0b1c2d3e4f5a"

const GIVEN = { draftId: DRAFT_ID, invoiceNo: "00000123", invoiceId: "misa-inv-0002", issuedOn: "2026-11-13" } as const

/** The day the examples run on: the shop's own day, which the issue date is. */
const DAY = "2026-11-14"

const ARGS = { id: DRAFT_ID, invoiceNo: "00000123", providerRef: "misa-inv-0002", issuedOn: "2026-11-13" }

/** The draft as the CRM answers the write. */
const DRAFT = {
    id: DRAFT_ID,
    renewalId: "5b0f3c1e-2d4a-4e6b-8c7d-9a0b1c2d3e4f",
    purchaseId: null,
    customerCode: "KH-0001",
    lines: [],
    netVnd: 1_100_000,
    vatRatePercent: 8,
    vatVnd: 88_000,
    totalVnd: 1_188_000,
    state: "issued",
    priceSource: "placeholder",
    invoiceNo: "00000123",
    providerRef: "misa-inv-0002",
    issuedOn: DAY,
}

/**
 * `webbooks.issue-record` (Record the issued invoice, R57): ONE CRM write, no AI. It records the invoice the e-invoice service issued on
 * its draft (`nivo.api.crm.nivoweb.post.invoice-drafts.id.invoice`, mode `auto`: a record of what happened, it issues nothing): the
 * number, the service's id as the provider reference, and the issue date: MISA's own `issuedOn` from the issue's answer, else (none given) the run's day in the workspace's time zone (`run.day`, the
 * shop's own calendar day). A CRM refusal stops the run (the engine reports it; never silent). A person declining the write (a shop's
 * own `ask`) made a decision: nothing is recorded and the graph ends `not-invoiced` after the team line.
 */
export const webbooksIssueRecordNode: TemplateNode = defineTemplateNode({
    id: "webbooks.issue-record",
    title: webbooksText("node.issue-record.title"),
    description: {
        vi: "Ghi vào hệ thống khách hàng số hoá đơn đã xuất, mã của bên hoá đơn điện tử và ngày xuất.",
        en: "Records in the customer system the issued invoice's number, the e-invoice service's reference and the issue date.",
    },
    tools: [CRM_NIVOWEB.post_invoice_drafts_id_invoice],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    input,
    output,
    run: async (given, ctx) => {
        const { draftId, invoiceNo } = given
        if (draftId === null) return ctx.fail({ kind: "cannot", why: "no_draft_named" })
        if (invoiceNo === null) return ctx.fail({ kind: "cannot", why: "invoice_without_number" })
        const written = await ctx.tools.call(CRM_NIVOWEB.post_invoice_drafts_id_invoice, {
            id: draftId,
            invoiceNo,
            ...(given.invoiceId === null ? {} : { providerRef: given.invoiceId }),
            issuedOn: given.issuedOn ?? ctx.run.day,
        })
        if (!written.ok && written.declined === true) return { recorded: false, state: null }
        if (!written.ok)
            return ctx.fail({ kind: "cannot", why: `invoice_record_refused:${written.refusal}` }, written.facts)
        return { recorded: true, state: jsonText(written.value["state"]) }
    },
    examples: [
        {
            name: "records the number, the service's id and MISA's own issue date on the draft",
            params: {},
            input: GIVEN,
            day: DAY,
            tools: [{ id: CRM_NIVOWEB.post_invoice_drafts_id_invoice, args: ARGS, answer: crmOk(DRAFT) }],
            output: { recorded: true, state: "issued" },
        },
        {
            name: "MISA gave no issue date: the run's day in the shop's time zone",
            params: {},
            input: { ...GIVEN, issuedOn: null },
            day: DAY,
            tools: [{ id: CRM_NIVOWEB.post_invoice_drafts_id_invoice, args: { ...ARGS, issuedOn: DAY }, answer: crmOk(DRAFT) }],
            output: { recorded: true, state: "issued" },
        },
        {
            name: "a person declines the write: nothing is recorded",
            params: {},
            input: GIVEN,
            day: DAY,
            tools: [{ id: CRM_NIVOWEB.post_invoice_drafts_id_invoice, args: ARGS, answer: refused("declined") }],
            output: { recorded: false, state: null },
        },
        {
            name: "a CRM refusal of the write stops the run",
            params: {},
            input: GIVEN,
            day: DAY,
            tools: [{ id: CRM_NIVOWEB.post_invoice_drafts_id_invoice, args: ARGS, answer: refused("not_found") }],
            failure: { kind: "cannot", why: "invoice_record_refused:not_found" },
        },
        {
            name: "no number reached the step: nothing is written, the node cannot go on",
            params: {},
            input: { ...GIVEN, invoiceNo: null },
            failure: { kind: "cannot", why: "invoice_without_number" },
        },
        {
            name: "no draft reached the step: nothing is written, the node cannot go on",
            params: {},
            input: { ...GIVEN, draftId: null },
            failure: { kind: "cannot", why: "no_draft_named" },
        },
    ],
})
