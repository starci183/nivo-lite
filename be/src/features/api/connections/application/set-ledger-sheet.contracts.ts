/** What setLedgerSheet takes. */
export interface SetLedgerSheetRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The link or the id of the spreadsheet the ledger is written to. */
    readonly sheet: string
}
