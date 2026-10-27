import type { PaymentCredit, ReceivableSnapshot } from "./accounting-gateway.port"

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
    /** The tools that answered each role this morning, cited as the card's live sources. */
    readonly tools: SummaryTools
    /** The optional features that did not run because the workspace has no tool for their role, shown as not connected. */
    readonly notConnected: ReadonlyArray<DeskFeature>
}

/** The tool that answered each role of the morning run; null when the workspace has none or nothing answered. */
export interface SummaryTools {
    /** The `invoice.list` tool. */
    readonly invoices: string | null
    /** The `payment.credits.list` tool. */
    readonly credits: string | null
    /** The `receivable.find` tool. */
    readonly receivables: string | null
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
    /** The decision the actions act on: the work item a person approves or declines. */
    readonly ref?: HubCardRef
    /** The actions offered; only with a ref. */
    readonly actions?: ReadonlyArray<"approve" | "decline">
    /** The sources the card was built from (hub-cards v1 `sources`, precedence order). */
    readonly sources?: ReadonlyArray<HubCardSource>
    /** Type-specific data the Hub does not draw. */
    readonly data?: Readonly<Record<string, unknown>>
}

/** A payment the reconcile could not record alone: the receivable, the credit and the one-line summary. */
export interface PaymentQuestion {
    /** The receivable the memo names. */
    readonly receivable: ReceivableSnapshot
    /** The credit that does not pay its balance exactly. */
    readonly credit: PaymentCredit
    /** The one sentence the person decides on. */
    readonly summary: string
}

/** An e-invoice the checks raised: its source reference and the one-line summary. */
export interface InvoiceQuestion {
    /** The invoice's source reference, unique per workspace. */
    readonly ref: string
    /** The one sentence the person decides on. */
    readonly summary: string
}

/** An open supplier invoice and the outgoing payment that only partly matches it (the amount, or the invoice number). */
export interface UnclearPayment {
    /** The open supplier invoice. */
    readonly payable: GatewayPayable
    /** The outgoing payment, from the workspace's `payment.debits.list` tool. */
    readonly debit: PaymentCredit
}

/** How the outgoing payments matched the open supplier invoices. */
export interface PayableMatches {
    /** The invoices an outgoing payment of their exact amount, naming their number, paid. */
    readonly paid: ReadonlyArray<GatewayPayable>
    /** The invoices still to pay. */
    readonly open: ReadonlyArray<GatewayPayable>
    /** The open invoices an outgoing payment only partly matches, each for the chief accountant to confirm. */
    readonly unclear: ReadonlyArray<UnclearPayment>
}

/** A supplier payment the matching could not settle alone, with the one sentence the person decides on. */
export interface SupplierPaymentQuestion extends UnclearPayment {
    /** The one sentence the person decides on. */
    readonly summary: string
}

/** The display name of a connector, or null when the workspace has none for the role. */
export type OptionalConnectorName = string | null

/** The work item an exception card decides (hub-cards v1 `ref`). */
export interface HubCardRef {
    /** Always a work item: the existing decision flow approves or declines it. */
    readonly kind: "work_item"
    /** The work item id. */
    readonly id: string
}

/** One source a card used (hub-cards v1): its data layer, the kind of record, the record and how it reads. */
export interface HubCardSource {
    /** 1 MCP live data, 2 Second Brain, 3 agent self-learning, 4 NIVO base knowledge. */
    readonly layer: 1 | 2 | 3 | 4
    /** The kind of record, e.g. `mcp_tool`. */
    readonly kind: string
    /** The record, e.g. the tool name. */
    readonly ref: string
    /** What the reader sees. */
    readonly label: string
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

/**
 * How a morning run ended: it ran; the workspace has no tax profile; the accounting module is not installed; the installation
 * waits for its required connection (`needs_connection`); or it is not running for another reason (in setup, paused).
 */
export type DeskRunStatus = "ran" | "no_tax_profile" | "not_installed" | "needs_connection" | "not_running"

/** An optional feature of the desk that runs only when the workspace has a tool for its role. */
export type DeskFeature = "invoices" | "receivables"

/** Which optional features the workspace has tools for: e-invoices (`invoice.list`) and the reconcile (`receivable.*`). */
export interface DeskConnections {
    /** Whether a tool plays `invoice.list`. */
    readonly invoices: boolean
    /** Whether tools play `receivable.find` and `receivable.recordPayment`. */
    readonly receivables: boolean
}

/** What one morning run did for a workspace. */
export interface DailyOutcome {
    /** How the run ended. */
    readonly status: DeskRunStatus
    /** The card, or null when the morning did not run. */
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
    /** The `invoice.list` tool that answered, or null when the workspace has none. */
    readonly tool: string | null
}

/** A supplier invoice still to pay, as the workspace's `invoice.list` tool answers it. */
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

/** The window the renewal-to-cash story is read over: an instant range and the day the horizon counts from. */
export interface RenewalWindow {
    /** The first instant, inclusive. */
    readonly from: Date
    /** The last instant, exclusive. */
    readonly to: Date
    /** The day the horizon counts from, `YYYY-MM-DD` (Vietnam). */
    readonly day: string
}

/** One invoice of the renewal story. */
export interface RenewalInvoice {
    /** The invoice number, e.g. `INV-202610-0001`. */
    readonly invoiceNo: string
    /** The amount, VND. */
    readonly amountVnd: number
    /** The customer, or an empty text when unknown. */
    readonly customer: string
}

/** A renewal invoice paid and matched, with the contract's end date now. */
export interface RenewalPaid extends RenewalInvoice {
    /** The contract's end date now, `YYYY-MM-DD`. */
    readonly endsOn: string
    /** True when the payment extended the contract past the billed period. */
    readonly extended: boolean
}

/** An invoice still unpaid, with its due day. */
export interface RenewalUnpaid extends RenewalInvoice {
    /** The due day, `YYYY-MM-DD` (Vietnam). */
    readonly dueOn: string
}

/** An active contract ending soon with no renewal invoice yet. */
export interface RenewalExpiring {
    /** The customer. */
    readonly customer: string
    /** The plan, or an empty text. */
    readonly plan: string
    /** The end date, `YYYY-MM-DD`. */
    readonly endsOn: string
}

/** A payment received that is not matched to an invoice and waits for a decision. */
export interface RenewalUnmatched {
    /** The amount, VND. */
    readonly amountVnd: number
    /** The payer, or an empty text. */
    readonly sender: string
    /** The transfer content, or an empty text. */
    readonly memo: string
}

/** A counted part of the story: how many, their total, and the first few. */
export interface RenewalTally<Item> {
    /** How many there are in all. */
    readonly count: number
    /** Their total, VND. */
    readonly totalVnd: number
    /** The first few, in the order the report lists them. */
    readonly items: ReadonlyArray<Item>
}

/** The renewal-to-cash story of a window: issued, paid and matched, still unpaid, expiring without an invoice, unmatched money. */
export interface RenewalCashStory {
    /** The day the horizon counts from, `YYYY-MM-DD`. */
    readonly day: string
    /** The last day of the horizon, `YYYY-MM-DD`. */
    readonly horizonDay: string
    /** The renewal invoices issued in the window. */
    readonly issued: RenewalTally<RenewalInvoice>
    /** The renewal payments received and matched in the window. */
    readonly paid: RenewalTally<RenewalPaid>
    /** The invoices still unpaid that fall due by the horizon (overdue ones included). */
    readonly unpaid: RenewalTally<RenewalUnpaid>
    /** The active contracts ending by the horizon with no renewal invoice yet. */
    readonly expiring: RenewalTally<RenewalExpiring>
    /** The money received but not matched, waiting for a decision. */
    readonly unmatched: RenewalTally<RenewalUnmatched>
}

/** The renewal-to-cash story and its report lines, as the daily report and the accounting desk print them. */
export interface RenewalCashReport {
    /** The figures. */
    readonly story: RenewalCashStory
    /** The report lines, Vietnamese, in the house bullet format. */
    readonly lines: ReadonlyArray<string>
}
