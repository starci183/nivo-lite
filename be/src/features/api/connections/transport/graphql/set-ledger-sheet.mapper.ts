import type { GoogleLedgerResult } from "../../application/get-google-state.contracts"
import type { SetLedgerSheetRequest } from "../../application/set-ledger-sheet.contracts"
import type { GoogleLedgerType } from "./dto/google-state.type"
import type { SetLedgerSheetInput } from "./dto/set-ledger-sheet.input"

/** Maps the GraphQL arguments of setLedgerSheet to the request. */
export const toSetLedgerSheetRequest = (workspaceId: string, input: SetLedgerSheetInput): SetLedgerSheetRequest => ({
    workspaceId,
    sheet: input.sheet,
})

/** Maps the answer of setLedgerSheet to the GraphQL type. */
export const toSetLedgerSheetType = (result: GoogleLedgerResult): GoogleLedgerType => result
