import { Command } from "@nestjs/cqrs"
import type { GoogleLedgerResult } from "./get-google-state.contracts"
import type { SetLedgerSheetRequest } from "./set-ledger-sheet.contracts"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Names the Google spreadsheet the ledger is written to. */
export class SetLedgerSheetCommand extends Command<GoogleLedgerResult> {
    constructor(readonly params: ExecuteParams<SetLedgerSheetRequest>) {
        super()
    }
}
