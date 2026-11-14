import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { LINE_MAX, dateSchema, idSchema, localeSchema } from "./books-shapes"
import { crmOk, ownOk } from "./books.fixtures"
import { webbooksText } from "../../modules/webbooks/copy"

/**
 * One supplier-invoice mail as the Mailbox agent hands it on: the mail's id, sender and subject, and its summary in the Mailbox
 * agent's words (the invoice number and amount AS WRITTEN in the mail; never a fact until the e-invoice or the payables say so).
 */
export type SupplierMail = {
    /** The id of the mail this concerns. */
    readonly mailId: string
    /** The sender's address. */
    readonly from: string
    /** The mail subject. */
    readonly subject: string
    /** A one-line summary of what was said, kept for the team notice and later steps. */
    readonly summary: string
}

/** The members of a handed supplier mail. */
const supplierMailShape = {
    mailId: idSchema,
    from: z.string().max(400),
    subject: z.string().max(400),
    summary: z.string().max(LINE_MAX),
}

/** The schema of a handed supplier mail: the graph's input items. */
export const supplierMailSchema: z.ZodType<SupplierMail> = z.object(supplierMailShape)

/** One handed mail and the language the team reads. */
const input = z.object({ ...supplierMailShape, locale: localeSchema })

/**
 * What the check found for the mail (handed on whole by the note, the loop's `collect`, read by the report). When `matched`, the
 * note members say what the next step records on the payable; none of them is an amount.
 */
export type SupplierCheckOutput = {
    /** The id of the mail this concerns. */
    readonly mailId: string
    /** True when the mail matched a supplier's invoice. */
    readonly matched: boolean
    /** The CRM code of the supplier; null when none matched. */
    readonly partyCode: string | null
    /** The reference of the e-invoice; null when none was found. */
    readonly einvoiceRef: string | null
    /** The invoice number; null when none was found. */
    readonly invoiceNo: string | null
    /** The day the invoice was issued; null when unknown. */
    readonly issuedOn: string | null
    /** A note on the check; null when none. */
    readonly note: string | null
    /** The reason, in words the team can read. */
    readonly why: string
}

/** The zod type of each member of what the check found. */
export interface SupplierCheckShape {
    /** The id of the mail this concerns. */
    readonly mailId: z.ZodString
    /** True when the mail matched a supplier's invoice. */
    readonly matched: z.ZodBoolean
    /** The CRM code of the supplier; null when none matched. */
    readonly partyCode: z.ZodNullable<z.ZodString>
    /** The reference of the e-invoice; null when none was found. */
    readonly einvoiceRef: z.ZodNullable<z.ZodString>
    /** The invoice number; null when none was found. */
    readonly invoiceNo: z.ZodNullable<z.ZodString>
    /** The day the invoice was issued; null when unknown. */
    readonly issuedOn: z.ZodNullable<z.ZodString>
    /** The note written on the record. */
    readonly note: z.ZodNullable<z.ZodString>
    /** The reason, in words the team can read. */
    readonly why: z.ZodString
}

/** The members of what the check found: the check's output, handed on whole by the note (the loop's `collect`). */
export const supplierCheckShape: SupplierCheckShape = {
    mailId: idSchema.describe("The `mailId` you were given."),
    matched: z.boolean().describe("True when a received e-invoice and a payable both confirm what the mail says."),
    partyCode: idSchema
        .nullable()
        .describe("The payable's `partyCode` the invoice belongs to, as the CRM listed it; null when none."),
    einvoiceRef: idSchema
        .nullable()
        .describe("The received e-invoice's `id`, as the e-invoice read answered it; null when none."),
    invoiceNo: z
        .string()
        .max(40)
        .nullable()
        .describe("The e-invoice's number, as the e-invoice read answered it; null when none."),
    issuedOn: dateSchema.describe("The e-invoice's issue date, as the e-invoice read answered it; null when none."),
    note: z
        .string()
        .max(LINE_MAX)
        .nullable()
        .describe("A short note for the payable when matched (never an amount); null otherwise."),
    why: z
        .string()
        .min(1)
        .max(LINE_MAX)
        .describe("One line in the team's language: what matched, or what a person must look at."),
}

/** The schema of what the check found, shared with the note. */
export const supplierCheckOutputSchema: z.ZodType<SupplierCheckOutput> = z
    .object(supplierCheckShape)
    .refine(
        (found) =>
            !found.matched ||
            [found.partyCode, found.einvoiceRef, found.invoiceNo, found.issuedOn, found.note].every((m) => m !== null),
        {
            message: "A matched invoice names the payable, the e-invoice, its number, its date and the note.",
            path: ["matched"],
        },
    )

/**
 * The reads the agent may make: the received e-invoices (NIVO's own), the payables, the company's truths on who the suppliers
 * are.
 */
const READS = [TOOL.einvoiceList, TOOL.einvoiceGet, CRM_NIVOWEB.get_payables]

const GOAL =
    "Check one supplier invoice the Mailbox agent saw in a mail. The mail's words are a lead, never a fact: find the e-invoice the " +
    "platform received and the supplier's payable, and use the company's truths on who the suppliers are. When the e-invoice and a " +
    "payable confirm it, answer matched with the payable's party code, the e-invoice's id, number and date as the reads answered them and " +
    "a short note (never an amount). Otherwise answer not matched and say in `why` what a person must look at."

const MAIL: SupplierMail = {
    mailId: "4e5f6071-8293-4dae-9fb0-3c4d5e6f7a8b",
    from: "billing@supplier.example",
    subject: "Hoa don dien tu thang 11",
    summary: "Nha cung cap gui hoa don so 0000456 ngay 10/11/2026, ghi tong 2.200.000d.",
}

const EINVOICES = {
    invoices: [
        {
            id: "rec-0009:0",
            sellerTaxCode: "0300000009",
            sellerName: "Nha cung cap Mau",
            number: "0000456",
            series: "1C26TAA",
            issuedOn: "2026-11-10",
            totalVnd: 2_200_000,
            vatVnd: 200_000,
            format: "xml",
        },
    ],
}

const EINVOICE = {
    found: true,
    id: "rec-0009:0",
    seller: { taxCode: "0300000009", name: "Nha cung cap Mau" },
    buyer: { taxCode: "0100000000", name: "Cong ty dung thu" },
    number: "0000456",
    series: "1C26TAA",
    issuedOn: "2026-11-10",
    lines: [{ name: "Hosting thang 11", qty: 1, unitPriceVnd: 2_000_000, vatRate: "10%", amountVnd: 2_000_000 }],
    subtotalVnd: 2_000_000,
    totalVnd: 2_200_000,
    vatVnd: 200_000,
}

const PAYABLES = {
    items: [
        {
            partyCode: "NCC-MAU",
            partyName: "Nha cung cap Mau",
            closingCreditVnd: 2_200_000,
            closingDebitVnd: 0,
            noteCount: 0,
            lastNoteInvoiceNo: null,
        },
    ],
    nextCursor: null,
}

/** What the check of the worked example finds. */
export const MATCHED_EXAMPLE: SupplierCheckOutput = {
    mailId: MAIL.mailId,
    matched: true,
    partyCode: "NCC-MAU",
    einvoiceRef: "rec-0009:0",
    invoiceNo: "0000456",
    issuedOn: "2026-11-10",
    note: "Hoa don hosting thang 11, khop hoa don dien tu.",
    why: "Hoa don 0000456 co trong hoa don dien tu va khop cong no phai tra NCC-MAU.",
}

/**
 * `webbooks.supplier-check` (Check against payables): split from `webbooks.supplier-match`, the first body step of the supplier
 * loop. Reads only: the agent confirms the invoice on the platform's received e-invoices and the CRM's payables (the mail is a
 * lead, never the proof) and answers what a confirmed one records, or what a person must look at. The note step takes it whole and
 * writes only for a matched one.
 */
export const webbooksSupplierCheckNode: TemplateNode = defineTemplateNode({
    id: "webbooks.supplier-check",
    title: webbooksText("node.supplier-check.title"),
    description: { vi: "\u0110\u1ed1i chi\u1ebfu ho\u00e1 \u0111\u01a1n nh\u00e0 cung c\u1ea5p v\u1edbi ho\u00e1 \u0111\u01a1n \u0111i\u1ec7n t\u1eed \u0111\u00e3 nh\u1eadn v\u00e0 c\u00f4ng n\u1ee3 ph\u1ea3i tr\u1ea3.", en: "Checks a supplier invoice against the received e-invoices and the payables." },
    tools: READS,
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    input,
    output: supplierCheckOutputSchema,
    model: "claude-sonnet-5-5",
    sensitive: { why: "pii" },
    run: (given, ctx) =>
        ctx.agent.run({ goal: GOAL, input: given, output: supplierCheckOutputSchema, maxTurns: 6, tools: READS }),
    examples: [
        {
            name: "finds the e-invoice and the supplier's payable: matched, with what the note records",
            params: {},
            input: { ...MAIL, locale: "vi" },
            agent: [
                {
                    answer: MATCHED_EXAMPLE,
                    calls: [
                        { id: TOOL.einvoiceList, args: { limit: 20 }, answer: ownOk(EINVOICES) },
                        { id: TOOL.einvoiceGet, args: { id: "rec-0009:0" }, answer: ownOk(EINVOICE) },
                        { id: CRM_NIVOWEB.get_payables, args: { limit: 50 }, answer: crmOk(PAYABLES) },
                    ],
                },
            ],
            output: MATCHED_EXAMPLE,
        },
    ],
})
