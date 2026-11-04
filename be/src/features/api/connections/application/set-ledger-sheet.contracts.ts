import type { GoogleLedgerResult } from "./get-google-state.contracts"

/** What setLedgerSheet takes. */
export interface SetLedgerSheetRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The link or the id of the spreadsheet the ledger is written to. */
    readonly sheet: string
}

/** What setLedgerSheet answers: where the ledger stands now. */
export type SetLedgerSheetResult = GoogleLedgerResult
