import { CommandHandler } from "@nestjs/cqrs"
import { GoogleConnectionsService, SheetsGrantService } from "@modules/domain/google-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AuthorizeGoogleResult } from "./authorize-google.contracts"
import { AuthorizeGoogleCommand } from "./authorize-google.command"

@CommandHandler(AuthorizeGoogleCommand)
/** Starts the Google consent through the GoogleConnectionsService, or the ledger spreadsheets consent through the SheetsGrantService. */
export class AuthorizeGoogleHandler extends ICQRSHandler<AuthorizeGoogleCommand, AuthorizeGoogleResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly google: GoogleConnectionsService,
        private readonly sheets: SheetsGrantService,
    ) {
        super(logger)
    }

    protected override process(command: AuthorizeGoogleCommand): Promise<AuthorizeGoogleResult> {
        const { request, principal } = command.params
        const actor = { principalId: principal.id, workspaceId: request.workspaceId }
        return request.purpose === "sheets"
            ? this.sheets.authorize(actor, request.returnTo)
            : this.google.authorize(actor, request.returnTo)
    }
}
