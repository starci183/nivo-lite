import { CommandHandler } from "@nestjs/cqrs"
import { SheetsGrantService } from "@modules/domain/google-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetLedgerSheetCommand } from "./set-ledger-sheet.command"
import type { SetLedgerSheetResult } from "./set-ledger-sheet.contracts"

@CommandHandler(SetLedgerSheetCommand)
/** Names the ledger spreadsheet through the SheetsGrantService; only the owner may. */
export class SetLedgerSheetHandler extends ICQRSHandler<SetLedgerSheetCommand, SetLedgerSheetResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sheets: SheetsGrantService,
    ) {
        super(logger)
    }

    protected override process(command: SetLedgerSheetCommand): Promise<SetLedgerSheetResult> {
        const { request, principal } = command.params
        return this.sheets.setLedgerSheet(
            { principalId: principal.id, workspaceId: request.workspaceId },
            request.sheet,
        )
    }
}
