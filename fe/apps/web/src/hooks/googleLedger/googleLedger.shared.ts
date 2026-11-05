/** Where the ledger kept in a Google spreadsheet stands: no access, access without a sheet, working, or the access was withdrawn. */
export type LedgerState = "none" | "granted" | "ready" | "lost"

/** The ledger state the back end names; a word it does not know reads as no access. */
export const ledgerStateOf = (value: string): LedgerState =>
    value === "granted" || value === "ready" || value === "lost" ? value : "none"
