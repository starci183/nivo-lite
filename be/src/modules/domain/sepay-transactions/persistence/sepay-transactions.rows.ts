import type { SettleOutcome } from "../sepay-transactions.contracts"

/** The outcome text the SQL settlement answers. */
export interface SettleRow {
    /** What the transfer came to for the order it named. */
    readonly outcome: SettleOutcome
}
