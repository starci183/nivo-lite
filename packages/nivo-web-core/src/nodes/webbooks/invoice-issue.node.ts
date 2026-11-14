import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webbooksText } from "../../modules/webbooks/copy"
import { idSchema, jsonText, localeSchema } from "./books-shapes"
import { ownOk, refused } from "./books.fixtures"
import { CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"

/**
 * The draft to issue and the renewal it belongs to. The graph reaches this step only once a draft was opened (a declined draft routes
 * away), but a branch does not narrow a ref: the draft id is typed nullable and a null one is refused exactly.
 */
const input = z.object({
    draftId: idSchema.nullable(),
    renewalId: idSchema,
    locale: localeSchema,
})

/**
 * What the issue answered: the invoice number (none on a dry run), its state, and whether it was a dry run; or, when the owner
 * declined the issue (`declined` true: a decision, the graph tells the team and ends `declined`), nothing issued: its members null.
 */
const output = z.object({
    invoiceNo: z
        .string()
        .min(1)
        .max(40)
        .nullable()
        .describe("The invoice number exactly as the issue answered it; null when it answered none."),
    state: z.string().min(1).max(40).nullable().describe("The invoice's `state` exactly as the issue answered it."),
    dryRun: z.boolean().nullable().describe("The issue's `dryRun`, as it answered it; null when declined."),
    declined: z.boolean().describe("True when the owner declined the issue."),
})

const RENEWAL_ID = "5b0f3c1e-2d4a-4e6b-8c7d-9a0b1c2d3e4f"
const DRAFT_ID = "6c1a4d2f-3e5b-4f7c-9d8e-0b1c2d3e4f5a"

/** The issue's answer in the example: the invoice port is mocked, so it is a dry run with no number. */
const ISSUED = { id: "inv-0001", state: "dry_run", invoiceNo: null, dryRun: true }

const GIVEN = { draftId: DRAFT_ID, renewalId: RENEWAL_ID, locale: "vi" } as const

/**
 * `webbooks.invoice-issue` (Issue the invoice), converted in place: the legal act, `TOOL.invoiceCreate` (`ask`: the ONE node of the package a person must sign,
 * a tax document issued in the company's name; the draft is the CRM's own and no earlier step is approved, so every call waits for the owner's yes on an approval card), NIVO's own tool (`nivo`, no account of a provider), a dry run until
 * MISA is connected. The old agent only read the draft back to check it is the renewal's (an exact id equality) and copied the answer, so
 * the node is now ONE tool call and no AI: the renewal id goes with the draft id and the TOOL refuses a draft of another renewal
 * (ASSUMPTIONS-G T4: the tool's refusal set is open and no adapter answers it yet, so `draft_not_of_renewal` is assumed). The
 * owner who declines the issue made a decision: the node returns it (`declined` true, nothing issued) and the graph tells the team
 * and ends `declined` (no mail, no team report). Any other refusal (a draft of another renewal) is a fact the node cannot go past:
 * the invoice is the graph's purpose. Blocking. Idempotent by renewal in the adapter.
 */
export const webbooksInvoiceIssueNode: TemplateNode = defineTemplateNode({
    id: "webbooks.invoice-issue",
    title: webbooksText("node.invoice-issue.title"),
    description: { vi: "Xu\u1ea5t ho\u00e1 \u0111\u01a1n ch\u00ednh th\u1ee9c t\u1eeb b\u1ea3n nh\u00e1p \u0111\u00e3 \u0111\u01b0\u1ee3c duy\u1ec7t.", en: "Issues the official invoice from the approved draft." },
    tools: [TOOL.invoiceCreate],
    mode: "ask",
    accounts: [CRM_NIVOWEB_PROVIDER],
    input,
    output,
    run: async (given, ctx) => {
        const { draftId } = given
        if (draftId === null) return ctx.fail({ kind: "cannot", why: "no_draft_named" })
        const issued = await ctx.tools.call(TOOL.invoiceCreate, { draftId, renewalId: given.renewalId })
        if (!issued.ok && issued.declined === true)
            return { invoiceNo: null, state: null, dryRun: null, declined: true }
        if (!issued.ok)
            return ctx.fail({ kind: "cannot", why: `invoice_issue_refused:${issued.refusal}` }, issued.facts)
        const invoiceNo = issued.value["invoiceNo"]
        return {
            invoiceNo: typeof invoiceNo === "string" ? invoiceNo : null,
            state: jsonText(issued.value["state"]),
            dryRun: issued.value["dryRun"] === true,
            declined: false,
        }
    },
    examples: [
        {
            name: "issues the draft on the owner's yes and copies the answer (a dry run while MISA is mocked)",
            params: {},
            input: GIVEN,
            tools: [
                { id: TOOL.invoiceCreate, args: { draftId: DRAFT_ID, renewalId: RENEWAL_ID }, answer: ownOk(ISSUED) },
            ],
            output: { invoiceNo: null, state: "dry_run", dryRun: true, declined: false },
        },
        {
            name: "a real issue: the number as the issue answered it",
            params: {},
            input: GIVEN,
            tools: [
                {
                    id: TOOL.invoiceCreate,
                    args: { draftId: DRAFT_ID, renewalId: RENEWAL_ID },
                    answer: ownOk({ id: "inv-0002", state: "issued", invoiceNo: "00000123", dryRun: false }),
                },
            ],
            output: { invoiceNo: "00000123", state: "issued", dryRun: false, declined: false },
        },
        {
            name: "the owner declines: nothing is issued, declined returned (the graph tells the team, ends declined)",
            params: {},
            input: GIVEN,
            tools: [
                {
                    id: TOOL.invoiceCreate,
                    args: { draftId: DRAFT_ID, renewalId: RENEWAL_ID },
                    answer: refused("declined"),
                },
            ],
            output: { invoiceNo: null, state: null, dryRun: null, declined: true },
        },
        {
            name: "the draft is another renewal's: the issue refuses it, the node cannot go on",
            params: {},
            input: GIVEN,
            tools: [
                {
                    id: TOOL.invoiceCreate,
                    args: { draftId: DRAFT_ID, renewalId: RENEWAL_ID },
                    answer: refused("draft_not_of_renewal", { draftRenewalId: "other-renewal" }),
                },
            ],
            failure: { kind: "cannot", why: "invoice_issue_refused:draft_not_of_renewal" },
        },
        {
            name: "no draft reached the step: nothing is issued, the node cannot go on",
            params: {},
            input: { ...GIVEN, draftId: null },
            failure: { kind: "cannot", why: "no_draft_named" },
        },
    ],
})
