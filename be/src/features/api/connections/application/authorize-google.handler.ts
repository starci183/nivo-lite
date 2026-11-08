import { CommandHandler } from "@nestjs/cqrs"
import { GoogleConnectionsService } from "@modules/domain/google-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { AuthorizeGoogleResult } from "./authorize-google.contracts"
import { AuthorizeGoogleCommand } from "./authorize-google.command"

@CommandHandler(AuthorizeGoogleCommand)
/** Starts the Google consent the request names (the connection, or the ledger spreadsheets) through the GoogleConnectionsService. */
export class AuthorizeGoogleHandler extends ICQRSHandler<AuthorizeGoogleCommand, AuthorizeGoogleResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly google: GoogleConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: AuthorizeGoogleCommand): Promise<AuthorizeGoogleResult> {
        return this.google.consentFor(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.returnTo,
            command.params.request.purpose,
        )
    }
}
