import type { SettleOutcome } from "./sepay-transactions.contracts"

/**
 * The status a SePay transaction row ends in. An outgoing transfer is ignored. A second transfer for an order that is already paid
 * comes back from SQL as "ignored"; it stays listed for the manual review as unmatched.
 */
export const transactionStatus = (isCredit: boolean, outcome: SettleOutcome): SettleOutcome => {
    if (!isCredit) return "ignored"
    return outcome === "ignored" ? "unmatched" : outcome
}
