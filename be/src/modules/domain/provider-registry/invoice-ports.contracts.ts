import type { ConnectionRecord } from "@modules/domain/connections"

/**
 * THE GENERIC E-INVOICE ISSUE PURPOSE (`nivo.tool.invoice.create`): a provider that issues an e-invoice on the seller's account (the
 * connected account IS the seller). The request is the platform contract the tool already promises (`invoiceCreateTool` of
 * nivo-web-core: the draft to issue and the renewal it ties to); it is aligned with an e-invoice provider's own members only once that
 * provider's integration documentation is read (MISA meInvoice's is not publicly readable: its adapter refuses `not_available`).
 */
export interface InvoiceIssueRequest {
    /** The invoice draft, as the draft answer gave it. */
    readonly draftId: string
    /** The renewal the invoice ties to, or null. */
    readonly renewalId: string | null
}

/** An invoice the provider issued. */
export interface IssuedInvoice {
    /** The provider's id of the invoice. */
    readonly id: string
    /** Its state as the provider words it. */
    readonly state: string
    /** The invoice number, or null while the provider has not numbered it. */
    readonly invoiceNo: string | null
}

/** A provider that issues e-invoices. A failure is thrown with what it proves (`withProof`); a refusal is a `providerRefusal` (a `ProviderRegistryError`). */
export interface InvoiceIssuePort {
    /** The provider key. */
    readonly provider: string
    /** Issues one invoice on one account. */
    issue(connection: ConnectionRecord, request: InvoiceIssueRequest): Promise<IssuedInvoice>
}
