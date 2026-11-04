import { CommandHandler } from "@nestjs/cqrs"
import { SheetsGrantService } from "@modules/domain/google-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetLedgerSheetCommand } from "./set-ledger-sheet.command"
import type { GoogleLedgerResult } from "./get-google-state.contracts"

@CommandHandler(SetLedgerSheetCommand)
/** Names the ledger spreadsheet through the SheetsGrantService; only the owner may. */
export class SetLedgerSheetHandler extends ICQRSHandler<SetLedgerSheetCommand, GoogleLedgerResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sheets: SheetsGrantService,
    ) {
        super(logger)
    }

    protected override process(command: SetLedgerSheetCommand): Promise<GoogleLedgerResult> {
        return this.sheets.setLedgerSheet(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.sheet,
        )
    }
}
