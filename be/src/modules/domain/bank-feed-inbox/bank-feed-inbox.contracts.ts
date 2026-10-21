/** The provider identity admitted by a bank-feed receipt. */
export type BankFeedProvider = "casso" | "payos" | "sepay-feed"

/** What a payment connection reports before the connection decides how to book it: money in, or money out of the account. */
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
}

/** The payload stored for one workspace-feed receipt. */
export interface FeedReceiptPayload {
    /** The authenticated connection identity. */
    readonly connection: string
    /** The normalized credits of the delivery. */
    readonly credits: ReadonlyArray<IncomingCredit>
}

/** A pending receipt held by the caller's transaction lock. */
export interface PendingBankFeedInboxReceipt {
    /** The row to complete after successful booking. */
    readonly id: string
    /** The immutable receipt data. */
    readonly payload: FeedReceiptPayload
}

/** A pending receipt, or undefined when it is absent or already complete. */
export type BankFeedInboxReceiptLookup = PendingBankFeedInboxReceipt | undefined
