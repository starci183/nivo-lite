/** Where a record came from. Live and simulated money are never added together. */
export type AccountingOrigin = "live" | "simulated"

/** What kind of record a lineage step is. */
export type AccountingLineageKind = "order" | "invoice" | "payment" | "decision" | "adjustment"

/** One step of where a ledger line came from. */
export interface AccountingLineageStep {
    /** The kind of accounting evidence. */
    readonly kind: AccountingLineageKind
    /** The label of this evidence step. */
    readonly title: string
    /** Additional human evidence when present. */
    readonly detail: string | null
    /** The evidence time, ISO text. */
    readonly at: string | null
    /** The current record state. */
    readonly status: string | null
    /** The amount, in VND. */
    readonly amount: number | null
}

/** Whether a ledger line is money in or an amount owed. */
export type AccountingLedgerKind = "income" | "receivable"
/** The state of a ledger line. */
export type AccountingLedgerStatus = "issued" | "paid" | "void" | "settled" | "matched" | "unmatched" | "needs_review"
/** The kind of record a correction points at. */
export type AccountingTargetType = "invoice" | "transaction"

/** One line of the ledger derived from invoices and payments. */
export interface AccountingLedgerEntry {
    /** "inv:<id>" or "tx:<id>" */
    readonly id: string
    /** The kind of corrected record. */
    readonly targetType: AccountingTargetType
    /** The corrected record identifier. */
    readonly targetId: string
    /** The evidence time, ISO text. */
    readonly at: string
    /** The ledger line description. */
    readonly description: string
    /** The kind of accounting evidence. */
    readonly kind: AccountingLedgerKind
    /** The amount, in VND. */
    readonly amount: number
    /** The current record state. */
    readonly status: AccountingLedgerStatus
    /** The related invoice or order number. */
    readonly linked: string | null
    /** Whether the record is live or simulated. */
    readonly origin: AccountingOrigin
    /** The ordered source and decision history. */
    readonly lineage: ReadonlyArray<AccountingLineageStep>
    /** How many append-only corrections target this record. */
    readonly adjustmentCount: number
}
