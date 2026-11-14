import type { AccountOwner, PendingRow } from "@modules/domain/account-data"

/** The provider identity admitted by a bank-feed receipt. */
export type BankFeedProvider = "casso" | "payos" | "sepay-feed"

/** One movement a payment connection reports: money in, or money out of the account. */
export interface IncomingCredit {
    /** The moved amount in VND, always positive. */
    readonly amount: number
    /** The transfer content. */
    readonly content: string
    /** The provider-prefixed transaction id: the idempotency key. */
    readonly eventId: string
    /** The bank name to show when the connection has no name. */
    readonly fallbackBankName: string
    /** `debit` for money that left the account (a supplier payment); absent for money that came in. */
    readonly direction?: "debit"
    /** The bank account number the movement belongs to, when the provider says. */
    readonly account?: string
    /** Who paid, when the provider says. */
    readonly payer?: string
    /** When the bank booked the movement, ISO text, when the provider says. */
    readonly occurredAt?: string
    /**
     * The BANK's own reference of the movement (the transfer's reference number at the bank), when the provider passes it on: never the
     * provider's row id. With the account number and the amount it names the movement whichever feed reports it.
     */
    readonly bankRef?: string
}

/** The payload stored for one workspace-feed receipt. */
export interface FeedReceiptPayload {
    /** The authenticated connection identity. */
    readonly connection: string
    /** The normalized credits of the delivery. */
    readonly credits: ReadonlyArray<IncomingCredit>
    /** `poll` when a reconcile run read the transaction back from the provider because its webhook never delivered it; absent for a webhook delivery. */
    readonly source?: "poll"
}

/** A pending delivery of a bank door, held by the caller's transaction lock until its consumption and completion commit together. */
export interface PendingBankFeedInboxReceipt {
    /** The receipt data, in the shape the consumer reads (the connection is the account's). */
    readonly payload: FeedReceiptPayload
    /** The account the delivery belongs to. */
    readonly owner: AccountOwner
    /** The locked delivery row, as its completion needs it. */
    readonly row: PendingRow
}

/** A pending receipt, or undefined when it is absent or already complete. */
export type BankFeedInboxReceiptLookup = PendingBankFeedInboxReceipt | undefined
