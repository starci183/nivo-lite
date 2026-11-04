import { Command } from "@nestjs/cqrs"
import type { SetLedgerSheetRequest, SetLedgerSheetResult } from "./set-ledger-sheet.contracts"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Names the Google spreadsheet the ledger is written to. */
export class SetLedgerSheetCommand extends Command<SetLedgerSheetResult> {
    constructor(readonly params: ExecuteParams<SetLedgerSheetRequest>) {
        super()
    }
}
