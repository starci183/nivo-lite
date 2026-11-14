import type { ConnectionRecord } from "@modules/domain/connections"

/**
 * THE GENERIC E-INVOICE ISSUE PURPOSE (`nivo.tool.invoice.create`): a provider that issues an e-invoice on the seller's account (the
 * connected account IS the seller). Owner ruling R57: the invoice is issued AT the e-invoice provider through its account; NIVO keeps no
 * invoice of its own and the CRM only stores the result. The request is what the tool takes (the stored draft to issue and the renewal
 * it ties to); it is aligned with an e-invoice provider's own members only once that provider's integration documentation is read (MISA
 * meInvoice's is not publicly readable: its live adapter refuses `not_available`).
 */
export interface InvoiceIssueRequest {
    /** The invoice draft, as the draft answer gave it. */
    readonly draftId: string
    /** The renewal the invoice ties to, or null. */
    readonly renewalId: string | null
}

/** An invoice the provider issued. */
export interface IssuedInvoice {
    /** The provider's id of the invoice (its reference). */
    readonly id: string
    /** Its state as the provider words it. */
    readonly state: string
    /** The invoice number, or null while the provider has not numbered it. */
    readonly invoiceNo: string | null
    /** The issue date the provider stated (`YYYY-MM-DD`), or null / absent when its answer states none. */
    readonly issuedOn?: string | null | undefined
}

/** A provider that issues e-invoices. A failure is thrown with what it proves (`withProof`); a refusal is a `providerRefusal` (a `ProviderRegistryError`). */
export interface InvoiceIssuePort {
    /** The provider key. */
    readonly provider: string
    /** Issues one invoice on one account. */
    issue(connection: ConnectionRecord, request: InvoiceIssueRequest): Promise<IssuedInvoice>
}

/**
 * Every refusal `nivo.tool.invoice.create` answers, whichever e-invoice provider served it: `rejected` (the provider refused the invoice
 * as asked: nothing issued), `not_found` (the draft or the seller is not at the provider), `not_connected` (no account handed, none found,
 * or no port registered for its provider), `connection_refused` (the provider refused the credential) and `not_available` (the operation
 * is not built: the provider's documentation could not be read). A leaf list, so the engine's tool registry states it without importing
 * the tool family.
 */
export const INVOICE_TOOL_REFUSALS: readonly ["rejected", "not_found", "not_connected", "connection_refused", "not_available"] = [
    "rejected",
    "not_found",
    "not_connected",
    "connection_refused",
    "not_available",
] as const

/** One refusal of the invoice tool. */
export type InvoiceToolRefusal = (typeof INVOICE_TOOL_REFUSALS)[number]

/**
 * The refusals a node reads and branches on (class `business` in the tool's `INVOICE_REFUSAL_CLASS`, a spec holds the two equal): what
 * the tool spec lists. The others (the setup) freeze the step.
 */
export const INVOICE_TOOL_BUSINESS_REFUSALS: readonly ["rejected", "not_found"] = ["rejected", "not_found"] as const
