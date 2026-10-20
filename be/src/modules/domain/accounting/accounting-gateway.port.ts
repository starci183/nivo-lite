import type { EinvoiceDraft, GatewayPayable } from "./accounting-desk.contracts"

/** A HAKUEN folio as `folio.get` answers it (hakuen-mcp@1; the members the accounting agent reads). */
export interface FolioSnapshot {
    /** The folio id. */
    readonly folioId: string
    /** The stay it belongs to. */
    readonly stayId: string
    /** The guest. */
    readonly guestName: string
    /** The room. */
    readonly roomNumber: string
    /** What is still due, VND. */
    readonly balanceVnd: number
    /** What is already paid, VND. */
    readonly paidVnd: number
    /** The bank-transfer memo printed for the guest, e.g. `HAKUEN F7K2Q9`. */
    readonly transferRef: string
}

/** A folio transfer memo, or null when a transfer content carries none. */
export type OptionalTransferCode = string | null

/** How a bank credit stands against a folio. */
export type FolioMatch = "exact" | "partial" | "over" | "settled"

/** A payment to record on a folio (`folio.recordPayment`). */
export interface FolioPayment {
    /** The folio. */
    readonly folioId: string
    /** The bank transaction reference; HAKUEN is idempotent on it. */
    readonly bankTxnRef: string
    /** The amount, VND. */
    readonly amountVnd: number
}

/** One e-invoice as the gateway's `einvoice.list` answers it: its source reference and the fields read from the XML or PDF. */
export interface GatewayEinvoice {
    /** The source reference (mail message and file), unique per workspace. */
    readonly ref: string
    /** The invoice fields. */
    readonly draft: EinvoiceDraft
}

/** One bank credit as `sepay.transactions.list` answers it. */
export interface GatewayBankCredit {
    /** The bank transaction reference. */
    readonly bankTxnRef: string
    /** The transfer content. */
    readonly content: string
    /** The amount, VND. */
    readonly amountVnd: number
    /** When it happened, ISO text. */
    readonly occurredAt: string
    /** True once reconciled (against an invoice or a folio). */
    readonly matched: boolean
}

/** A folio, or null when the gateway knows none. */
export type OptionalFolio = FolioSnapshot | null

/**
 * Every source the accounting agent reads, as tools of the NIVO MCP gateway: `einvoice.list` (the invoice inbox, read and parsed
 * by the gateway's einvoice adapter), `sepay.transactions.list` (the bank feed), `hakuen.folio.get` and
 * `hakuen.folio.recordPayment`. The gateway applies the grant, the approval and the audit; the desk never reads a source itself.
 * The app root binds the adapter; until the gateway branch is merged the unwired adapter answers that nothing is there.
 */
export interface AccountingGateway {
    /** `einvoice.list`: the supplier e-invoices received since `since` (ISO instant). */
    listEinvoices(workspaceId: string, since: string): Promise<ReadonlyArray<GatewayEinvoice>>
    /** `einvoice.list` with `unpaid: true`: the supplier invoices still to pay. */
    listOpenPayables(workspaceId: string): Promise<ReadonlyArray<GatewayPayable>>
    /** `sepay.transactions.list`: the bank credits since `since` (ISO instant). */
    listBankCredits(workspaceId: string, since: string): Promise<ReadonlyArray<GatewayBankCredit>>
    /** The folio whose transfer memo is `transferRef`; null when none carries it. */
    findByTransferRef(workspaceId: string, transferRef: string): Promise<OptionalFolio>
    /** `folio.recordPayment`; answers true when HAKUEN recorded it (a duplicate counts as recorded). */
    recordPayment(workspaceId: string, payment: FolioPayment): Promise<boolean>
}
