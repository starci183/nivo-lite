/** Log events of the bank-feed receipts. */
export enum BankFeedInboxLogEvent {
    /** A verified delivery named a connection no account holds, so nothing was kept. */
    UnknownConnection = "bank_feed.receipt.unknown_connection",
}
