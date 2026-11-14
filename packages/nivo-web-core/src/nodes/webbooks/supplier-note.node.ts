import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webbooksText } from "../../modules/webbooks/copy"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { idSchema, jsonText } from "./books-shapes"
import { crmOk, refused } from "./books.fixtures"
import { MATCHED_EXAMPLE, type SupplierCheckOutput, supplierCheckShape } from "./supplier-check.node"

/**
 * What the check found for one mail, whole (every item reaches this step). When `matched`, the check's own schema makes every note
 * member present; a ref is not narrowed by that, so they are typed nullable and a null one is refused exactly.
 */
const input = z.object(supplierCheckShape)

/**
 * What the item came to: what the check found, handed on whole, and what became of the note. The loop's `collect`, read by the
 * report: an unmatched invoice is not noted (`noteId` null, `declined` false), a matched one is noted (`noteId`) or its note was
 * declined by a person (`declined` true: the graph tells the team and ends the item).
 */
export type SupplierNoteOutput = SupplierCheckOutput & {
    /** The note `id` the CRM answered; null when nothing was noted. */
    readonly noteId: string | null
    /** True when a person declined the note. */
    readonly declined: boolean
}

/** The schema of what the item came to: the loop's `collect`, read by the report. */
export const supplierNoteOutputSchema: z.ZodType<SupplierNoteOutput> = z.object({
    ...supplierCheckShape,
    noteId: idSchema.nullable().describe("The note `id` the CRM answered; null when nothing was noted."),
    declined: z.boolean().describe("True when a person declined the note."),
})

const ARGS = {
    partyCode: "NCC-MAU",
    einvoiceRef: "rec-0009:0",
    invoiceNo: "0000456",
    issuedOn: "2026-11-10",
    note: "Hoa don hosting thang 11, khop hoa don dien tu.",
}

/** What the check of an invoice a person must look at found: not matched, nothing to note. */
const UNMATCHED: SupplierCheckOutput = {
    mailId: MATCHED_EXAMPLE.mailId,
    matched: false,
    partyCode: null,
    einvoiceRef: null,
    invoiceNo: null,
    issuedOn: null,
    note: null,
    why: "Khong tim thay hoa don dien tu 0000456: can nguoi xem.",
}

/**
 * `webbooks.supplier-note` (Note the invoice on the payable): split from `webbooks.supplier-match`, the last body step of the
 * supplier loop and its `collect`: it takes what the check found and hands it on whole with what became of the note. An unmatched
 * invoice (`matched` false, an exact boolean) is not noted: no call. A matched one is noted with ONE CRM write,
 * `payable.note.record`. The books do not change. No AI call. A person who declines the
 * note made a decision: the node returns it (`declined` true) and the graph tells the team and ends the item; the round goes on and
 * the report names it. Any other refusal is a fact the node cannot go past. Blocking: the note is the item's business.
 */
export const webbooksSupplierNoteNode: TemplateNode = defineTemplateNode({
    id: "webbooks.supplier-note",
    title: webbooksText("node.supplier-note.title"),
    description: { vi: "Ghi ch\u00fa ho\u00e1 \u0111\u01a1n nh\u00e0 cung c\u1ea5p \u0111\u00e3 kh\u1edbp v\u00e0o c\u00f4ng n\u1ee3 ph\u1ea3i tr\u1ea3.", en: "Notes the matched supplier invoice on the payable." },
    tools: [CRM_NIVOWEB.post_payables_party_code_notes],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    input,
    output: supplierNoteOutputSchema,
    sensitive: { why: "pii" },
    run: async (given, ctx) => {
        if (!given.matched) return { ...given, noteId: null, declined: false }
        const { partyCode, einvoiceRef, invoiceNo, issuedOn, note } = given
        if (partyCode === null || einvoiceRef === null || invoiceNo === null || issuedOn === null || note === null)
            return ctx.fail({ kind: "cannot", why: "matched_without_payable_note" })
        const recorded = await ctx.tools.call(CRM_NIVOWEB.post_payables_party_code_notes, {
            partyCode,
            einvoiceRef,
            invoiceNo,
            issuedOn,
            note,
        })
        if (!recorded.ok && recorded.declined === true) return { ...given, noteId: null, declined: true }
        if (!recorded.ok)
            return ctx.fail({ kind: "cannot", why: `payable_note_refused:${recorded.refusal}` }, recorded.facts)
        return { ...given, noteId: jsonText(recorded.value["id"]), declined: false }
    },
    examples: [
        {
            name: "records the matched invoice as a note on the supplier's payable",
            params: {},
            input: MATCHED_EXAMPLE,
            tools: [
                {
                    id: CRM_NIVOWEB.post_payables_party_code_notes,
                    args: ARGS,
                    answer: crmOk({
                        id: "pnote-0001",
                        state: "recorded",
                        ...ARGS,
                        recordedAt: "2026-11-12T02:30:00.000Z",
                    }),
                },
            ],
            output: { ...MATCHED_EXAMPLE, noteId: "pnote-0001", declined: false },
        },
        {
            name: "an unmatched invoice: nothing is noted, what the check found handed on for the report",
            params: {},
            input: UNMATCHED,
            output: { ...UNMATCHED, noteId: null, declined: false },
        },
        {
            name: "the CRM already holds a note for this e-invoice: the node cannot go on",
            params: {},
            input: MATCHED_EXAMPLE,
            tools: [{ id: CRM_NIVOWEB.post_payables_party_code_notes, args: ARGS, answer: refused("note_exists") }],
            failure: { kind: "cannot", why: "payable_note_refused:note_exists" },
        },
        {
            name: "a person declines the note: nothing noted, declined returned (the graph tells the team, the item ends)",
            params: {},
            input: MATCHED_EXAMPLE,
            tools: [{ id: CRM_NIVOWEB.post_payables_party_code_notes, args: ARGS, answer: refused("declined") }],
            output: { ...MATCHED_EXAMPLE, noteId: null, declined: true },
        },
        {
            name: "a member of the note is missing: nothing is noted, the node cannot go on",
            params: {},
            input: { ...MATCHED_EXAMPLE, partyCode: null },
            failure: { kind: "cannot", why: "matched_without_payable_note" },
        },
    ],
})
