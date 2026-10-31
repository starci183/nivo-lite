import type { DeskConnections, EinvoiceDraft, GatewayPayable, OptionalConnectorName } from "./accounting-desk.contracts"

/** What one capability role answered, and the tool that answered it (null when the workspace has no tool that answered the role). */
export interface RoleAnswer<T> {
    /** The full name of the tool that answered, cited as the card's source; null when nothing answered. */
    readonly tool: string | null
    /** The answer, empty when nothing answered. */
    readonly value: T
}

/** An open receivable as `receivable.find` answers it: its id at the connector and what is still due. */
export interface ReceivableSnapshot {
    /** The receivable id at the connector. */
    readonly receivableId: string
    /** What is still due, VND. */
    readonly balanceVnd: number
}

/** A receivable, or null when the connector found none for the reference. */
export type OptionalReceivable = ReceivableSnapshot | null

/** How a payment credit stands against a receivable. */
export type ReceivableMatch = "exact" | "partial" | "over" | "settled"

/** A payment to record on a receivable (`receivable.recordPayment`). */
export interface ReceivablePayment {
    /** The receivable. */
    readonly receivableId: string
    /** The credit's own reference; the payment is recorded once per credit. */
    readonly creditRef: string
    /** The amount, VND. */
    readonly amountVnd: number
}

/** One e-invoice as the workspace's `invoice.list` tool answers it: its source reference and the fields read from the XML or PDF. */
export interface GatewayEinvoice {
    /** The source reference, unique per workspace. */
    readonly ref: string
    /** The invoice fields. */
    readonly draft: EinvoiceDraft
}

/** One bank move as the workspace's `payment.credits.list` (money in) or `payment.debits.list` (money out) tool answers it. */
export interface PaymentCredit {
    /** The credit id at the connector. */
    readonly creditRef: string
    /** The payment memo, passed as it is to `receivable.find`. */
    readonly reference: string
    /** The amount, VND. */
    readonly amountVnd: number
    /** When it happened, ISO text. */
    readonly occurredAt: string
    /** True once the connector reports it reconciled. */
    readonly matched: boolean
}

/**
 * Every source the accounting agent reads, by capability role of the NIVO MCP gateway, never by a connector's name:
 * `invoice.list`, `payment.credits.list`, `receivable.find` and `receivable.recordPayment`. The gateway resolves each role to the
 * workspace's tool and applies the grant, the approval and the audit; the desk never reads a source itself. The app root binds
 * the adapter; without one the unwired adapter answers that nothing is there.
 */
export interface AccountingGateway {
    /** `invoice.list`: the supplier e-invoices received since `since` (ISO instant). */
    listEinvoices(workspaceId: string, since: string): Promise<RoleAnswer<ReadonlyArray<GatewayEinvoice>>>
    /** `invoice.list` over the payable window: the supplier invoices still to pay. */
    listOpenPayables(workspaceId: string): Promise<ReadonlyArray<GatewayPayable>>
    /** `payment.debits.list`: the outgoing payments since `since` (ISO instant), in the same shape as the credits. */
    listPaymentDebits(workspaceId: string, since: string): Promise<RoleAnswer<ReadonlyArray<PaymentCredit>>>
    /** `payment.credits.list`: the payment credits since `since` (ISO instant). */
    listPaymentCredits(workspaceId: string, since: string): Promise<RoleAnswer<ReadonlyArray<PaymentCredit>>>
    /** `receivable.find`: the open receivable a payment memo names, as the connector reads its own reference format. */
    findReceivable(workspaceId: string, reference: string): Promise<RoleAnswer<OptionalReceivable>>
    /** `receivable.recordPayment`: answers true when the connector recorded it (a duplicate counts as recorded). */
    recordPayment(workspaceId: string, payment: ReceivablePayment): Promise<boolean>
    /** The display name of the connector whose tool plays `payment.credits.list`, or null when the workspace has none. */
    creditsSource(workspaceId: string): Promise<OptionalConnectorName>
    /** The display name of the connector whose tool plays `invoice.list`, or null when the workspace has none. */
    payablesSource(workspaceId: string): Promise<OptionalConnectorName>
    /** Which optional features of the desk the workspace has tools for (e-invoices, the reconcile). */
    connections(workspaceId: string): Promise<DeskConnections>
}
