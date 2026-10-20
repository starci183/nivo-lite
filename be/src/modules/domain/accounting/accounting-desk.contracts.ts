/** How often the workspace files VAT (and withheld PIT): monthly, or quarterly for a prior-year revenue up to 50 billion VND. */
export type FilingPeriod = "monthly" | "quarterly"

/** The workspace tax profile the calendar is computed from (confirmed by the chief accountant). */
export interface TaxProfile {
    /** The workspace's own tax code (MST). */
    readonly taxCode: string
    /** The VAT filing period. */
    readonly vatPeriod: FilingPeriod
    /** True when the workspace withholds PIT on salaries. */
    readonly withholdsPit: boolean
    /** True when the workspace pays the annual license fee (le phi mon bai). */
    readonly paysLicenseFee: boolean
    /** The year the business was established; the license fee is waived that year. */
    readonly establishedYear: number
    /** How many days before a deadline the first reminder goes out. */
    readonly reminderDays: number
    /** The default supplier payment term in days, counted from the invoice date. */
    readonly supplierTermDays: number
}

/** The kind of obligation a deadline belongs to. */
export type ObligationKind = "vat" | "pit" | "cit_provisional" | "cit_finalization" | "pit_finalization" | "license_fee"

/** One computed statutory deadline. */
export interface TaxDeadline {
    /** The obligation. */
    readonly kind: ObligationKind
    /** The period it covers, e.g. `2026-09`, `2026-Q3` or `2026`. */
    readonly period: string
    /** The due date after moving off weekends and public holidays, `YYYY-MM-DD`. */
    readonly dueOn: string
    /** The legal basis, for the reminder line. */
    readonly basis: string
}

/** A supplier invoice waiting to be paid, as the calendar reads it. */
export interface PayableDue {
    /** The supplier name. */
    readonly supplier: string
    /** The invoice number. */
    readonly invoiceNo: string
    /** The amount, VND. */
    readonly amountVnd: number
    /** The due date, `YYYY-MM-DD`. */
    readonly dueOn: string
}

/** One entry of the upcoming list: a tax deadline or a supplier payment, with days left. */
export interface UpcomingDue {
    /** `tax` or `supplier`. */
    readonly source: "tax" | "supplier"
    /** The obligation kind, or `supplier_payment`. */
    readonly kind: ObligationKind | "supplier_payment"
    /** The covered period or the invoice number. */
    readonly ref: string
    /** The due date. */
    readonly dueOn: string
    /** Whole days from today. */
    readonly daysLeft: number
    /** The amount when known. */
    readonly amountVnd: number | null
    /** The legal basis or the supplier. */
    readonly note: string
}

/** One goods or services line of an e-invoice. */
export interface EinvoiceLine {
    /** The description. */
    readonly name: string
    /** The quantity. */
    readonly quantity: number
    /** The amount before VAT, VND. */
    readonly amountVnd: number
    /** The VAT rate in percent, or null for KCT / KKKNT (not subject). */
    readonly vatRate: number | null
}

/** An e-invoice as read from TT78 XML or extracted from a PDF. */
export interface EinvoiceDraft {
    /** `xml` (deterministic) or `pdf` (LLM extraction). */
    readonly source: "xml" | "pdf"
    /** Mau so, the template (KHMSHDon). */
    readonly template: string
    /** Ky hieu, the series (KHHDon). */
    readonly series: string
    /** So hoa don, the number (SHDon). */
    readonly invoiceNo: string
    /** Ngay lap, the issue date, `YYYY-MM-DD`. */
    readonly issuedOn: string
    /** Seller name. */
    readonly sellerName: string
    /** Seller tax code. */
    readonly sellerTaxCode: string
    /** Buyer name. */
    readonly buyerName: string
    /** Buyer tax code. */
    readonly buyerTaxCode: string
    /** The lines. */
    readonly lines: ReadonlyArray<EinvoiceLine>
    /** Total before VAT (TgTCThue). */
    readonly subtotalVnd: number
    /** VAT total (TgTThue). */
    readonly vatVnd: number
    /** Grand total (TgTTTBSo). */
    readonly totalVnd: number
}

/** Why an invoice needs a person. */
export type EinvoiceIssue =
    | "seller_tax_code_format"
    | "seller_tax_code_mismatch"
    | "buyer_tax_code_mismatch"
    | "subtotal_mismatch"
    | "vat_mismatch"
    | "total_mismatch"
    | "vat_rate_invalid"
    | "missing_fields"

/** The verdict of the checks. */
export type EinvoiceStatus = "valid" | "needs_review" | "invalid_tax_code"

/** What the checks answered. */
export interface EinvoiceVerdict {
    /** The status counted in the daily summary. */
    readonly status: EinvoiceStatus
    /** Every issue found, empty when valid. */
    readonly issues: ReadonlyArray<EinvoiceIssue>
}

/** The supplier record the seller tax code is compared with. */
export interface KnownSupplier {
    /** The supplier name. */
    readonly name: string
    /** The tax code on file. */
    readonly taxCode: string
}

/** A supplier on file, or null when the seller is not on file. */
export type OptionalSupplier = KnownSupplier | null

/** The counts the daily summary card shows. */
export interface DailySummaryInput {
    /** The day, `YYYY-MM-DD`. */
    readonly day: string
    /** Invoices checked valid in the window. */
    readonly valid: number
    /** Invoices waiting for a person. */
    readonly needsReview: number
    /** Invoices with a wrong tax code. */
    readonly invalidTaxCode: number
    /** Bank credits matched in the window. */
    readonly matched: number
    /** Bank credits still waiting for a match. */
    readonly unmatched: number
    /** The upcoming deadlines, soonest first. */
    readonly upcoming: ReadonlyArray<UpcomingDue>
}

/** One label/value row of a hub card. */
export interface HubCardField {
    /** The label. */
    readonly label: string
    /** The value, already formatted. */
    readonly value: string
}

/** One bulleted or timed line of a hub card. */
export interface HubCardLine {
    /** The time or tag, optional. */
    readonly at?: string
    /** The text. */
    readonly text: string
}

/** A result card as the Hub (contract hub-cards v1) stores it in `messages.card`; the subset this desk emits. */
export interface HubCardPayload {
    /** Always 1. */
    readonly v: 1
    /** `daily_summary` or `exception`. */
    readonly type: "daily_summary" | "exception"
    /** The title, 1..160 characters. */
    readonly title: string
    /** The subtitle. */
    readonly subtitle?: string
    /** The status word. */
    readonly badge?: string
    /** The long text. */
    readonly body?: string
    /** Label/value rows, at most 12. */
    readonly fields?: ReadonlyArray<HubCardField>
    /** Lines, at most 20. */
    readonly lines?: ReadonlyArray<HubCardLine>
    /** Type-specific data the Hub does not draw. */
    readonly data?: Readonly<Record<string, unknown>>
}

/** The document tiles of the morning card. */
export interface SummaryStats {
    /** Valid invoices. */
    readonly valid: number
    /** Invoices to review. */
    readonly needsReview: number
    /** Invoices with a wrong tax code. */
    readonly invalidTaxCode: number
}

/** The bank line of the morning card. */
export interface BankCounts {
    /** Credits matched in the window. */
    readonly matched: number
    /** Credits still waiting for a match. */
    readonly unmatched: number
}

/** A workspace tax profile, or null before one is confirmed. */
export type OptionalTaxProfile = TaxProfile | null

/** A supplier on file with its own payment term. */
export interface SupplierOnFile extends KnownSupplier {
    /** The payment term in days, or null for the profile default. */
    readonly termDays: number | null
}

/** The `daily_summary` hub card: the structured payload a renderer draws, and a plain text fallback. */
export interface DailySummaryCard {
    /** Always `daily_summary`. */
    readonly kind: "daily_summary"
    /** The room it goes to. */
    readonly room: "accounting"
    /** The day. */
    readonly day: string
    /** The headline line. */
    readonly headline: string
    /** Stat tiles: valid / to review / wrong MST. */
    readonly stats: SummaryStats
    /** The bank line. */
    readonly bank: BankCounts
    /** The next deadline, or null. */
    readonly next: UpcomingDue | null
    /** Up to five upcoming dues. */
    readonly upcoming: ReadonlyArray<UpcomingDue>
    /** The text the Office line carries when no card renderer is present. */
    readonly text: string
    /** The hub-cards v1 payload. */
    readonly hub: HubCardPayload
}

/** What one morning run did for a workspace. */
export interface DailyOutcome {
    /** The card, or null when the workspace has no tax profile. */
    readonly card: DailySummaryCard | null
    /** How many reminders went out. */
    readonly reminders: number
}

/** A Second Brain fact as the accounting desk reads it. */
export interface WorkspaceFact {
    /** The subject, e.g. `tax_profile` or `supplier:linh-an`. */
    readonly subjectKey: string
    /** The attribute, e.g. `tax_code`. */
    readonly attribute: string
    /** The value. */
    readonly value: string
}

/** The verdicts of the invoices reviewed in one run. */
export interface ReviewTally {
    /** Valid invoices. */
    readonly valid: number
    /** Invoices to review. */
    readonly needsReview: number
    /** Invoices with a wrong tax code. */
    readonly invalidTaxCode: number
}

/** A supplier invoice still to pay, as the gateway's `einvoice.list` answers it. */
export interface GatewayPayable {
    /** The seller. */
    readonly supplier: string
    /** The seller tax code. */
    readonly sellerTaxCode: string
    /** The invoice number. */
    readonly invoiceNo: string
    /** The total, VND. */
    readonly amountVnd: number
    /** The issue date, `YYYY-MM-DD`. */
    readonly issuedOn: string
}
