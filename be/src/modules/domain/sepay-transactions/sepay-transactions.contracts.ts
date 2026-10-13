/** What the SQL settlement made of a transfer for the order it named. */
export type SettleOutcome = "paid" | "underpaid" | "expired" | "unmatched" | "ignored"
