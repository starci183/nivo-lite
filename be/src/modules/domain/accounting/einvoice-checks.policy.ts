import type {
    EinvoiceDraft,
    EinvoiceIssue,
    EinvoiceVerdict,
    HubCardPayload,
    KnownSupplier,
    OptionalSupplier,
} from "./accounting-desk.contracts"
import { CARD_COPY, EXCEPTION_COPY, issueText } from "./messages/accounting-desk.messages"
import { isValidTaxCode, normalizeTaxCode, sameTaxCode } from "./tax-code.policy"

/** The VAT rates in force (Law on VAT 2024 and the 8% reduction of Decree 174/2025), percent. */
export const VAT_RATES: ReadonlyArray<number> = [0, 5, 8, 10]

/** The rounding allowance per line, VND. */
const ROUNDING_PER_LINE = 1

const normalizeName = (value: string): string =>
    value
        .normalize("NFD")
        .replaceAll(/\p{M}/gu, "")
        .toLowerCase()
        .replaceAll(/[^a-z\d]+/gu, " ")
        .trim()

/** The supplier on file whose name matches the seller's, or null. */
export const supplierOf = <T extends KnownSupplier>(draft: EinvoiceDraft, suppliers: ReadonlyArray<T>): T | null => {
    const name = normalizeName(draft.sellerName)
    return name === "" ? null : (suppliers.find((row) => normalizeName(row.name) === name) ?? null)
}

const taxCodeIssues = (draft: EinvoiceDraft, ownTaxCode: string, supplier: OptionalSupplier): Array<EinvoiceIssue> => {
    const issues: Array<EinvoiceIssue> = []
    if (!isValidTaxCode(draft.sellerTaxCode)) issues.push("seller_tax_code_format")
    else if (supplier !== null && !sameTaxCode(supplier.taxCode, draft.sellerTaxCode)) {
        issues.push("seller_tax_code_mismatch")
    }
    if (normalizeTaxCode(ownTaxCode) !== "" && !sameTaxCode(ownTaxCode, draft.buyerTaxCode)) {
        issues.push("buyer_tax_code_mismatch")
    }
    return issues
}

const amountIssues = (draft: EinvoiceDraft): Array<EinvoiceIssue> => {
    const issues: Array<EinvoiceIssue> = []
    const tolerance = Math.max(1, draft.lines.length) * ROUNDING_PER_LINE
    const subtotal = draft.lines.reduce((total, line) => total + line.amountVnd, 0)
    const vat = draft.lines.reduce((total, line) => total + Math.round((line.amountVnd * (line.vatRate ?? 0)) / 100), 0)
    const rateBroken = draft.lines.some((line) => line.vatRate !== null && !VAT_RATES.includes(line.vatRate))
    if (rateBroken) issues.push("vat_rate_invalid")
    if (draft.lines.length > 0 && Math.abs(subtotal - draft.subtotalVnd) > tolerance) issues.push("subtotal_mismatch")
    if (!rateBroken && Math.abs(vat - draft.vatVnd) > tolerance) issues.push("vat_mismatch")
    if (Math.abs(draft.subtotalVnd + draft.vatVnd - draft.totalVnd) > tolerance) issues.push("total_mismatch")
    return issues
}

/**
 * Checks an invoice: the seller tax code is well formed and matches the supplier on file, the buyer is this workspace, the
 * lines add up to the subtotal, the VAT follows the line rates and the total is subtotal plus VAT. A tax code problem is
 * `invalid_tax_code`; any other problem is `needs_review`.
 */
export const checkEinvoice = (
    draft: EinvoiceDraft,
    ownTaxCode: string,
    suppliers: ReadonlyArray<KnownSupplier>,
): EinvoiceVerdict => {
    if (draft.invoiceNo === "" || draft.sellerTaxCode === "" || draft.totalVnd <= 0) {
        return { status: "needs_review", issues: ["missing_fields"] }
    }
    const codes = taxCodeIssues(draft, ownTaxCode, supplierOf(draft, suppliers))
    const issues = [...codes, ...amountIssues(draft)]
    if (codes.length > 0) return { status: "invalid_tax_code", issues }
    return { status: issues.length === 0 ? "valid" : "needs_review", issues }
}

/** The accounting room line of an invoice that needs the chief accountant: what is wrong and what the agent proposes. */
export const exceptionText = (draft: EinvoiceDraft, verdict: EinvoiceVerdict, supplier: OptionalSupplier): string => {
    const head = EXCEPTION_COPY.head(draft.sellerName, draft.invoiceNo, draft.totalVnd)
    const reasons = verdict.issues.map((issue) => `- ${issueText(issue)}`)
    const proposal =
        verdict.status === "invalid_tax_code" ? EXCEPTION_COPY.proposeTaxCode : EXCEPTION_COPY.proposeReview
    const codes =
        supplier === null
            ? EXCEPTION_COPY.onInvoice(draft.sellerTaxCode)
            : EXCEPTION_COPY.onFile(draft.sellerTaxCode, supplier.taxCode)
    return [head, ...reasons, proposal, codes].join("\n")
}

/** The hub-cards v1 `exception` card of an invoice that needs the chief accountant. */
export const exceptionCard = (
    draft: EinvoiceDraft,
    verdict: EinvoiceVerdict,
    supplier: OptionalSupplier,
): HubCardPayload => {
    const isTaxCode = verdict.status === "invalid_tax_code"
    const fields = [
        { label: CARD_COPY.invoiceNo, value: `${draft.series} ${draft.invoiceNo}`.trim() },
        { label: CARD_COPY.total, value: CARD_COPY.money(draft.totalVnd) },
        { label: CARD_COPY.onInvoice, value: draft.sellerTaxCode },
    ]
    return {
        v: 1,
        type: "exception",
        title: CARD_COPY.invoiceTitle(draft.sellerName),
        badge: isTaxCode ? CARD_COPY.badgeTaxCode : CARD_COPY.badgeReview,
        body: isTaxCode ? EXCEPTION_COPY.proposeTaxCode : EXCEPTION_COPY.proposeReview,
        fields: supplier === null ? fields : [...fields, { label: CARD_COPY.onFile, value: supplier.taxCode }],
        lines: verdict.issues.map((issue) => ({ text: issueText(issue) })),
        data: { issues: verdict.issues, issuedOn: draft.issuedOn, sources: ["mcp:einvoice.list", "brain:supplier"] },
    }
}
