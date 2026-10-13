import { CommandHandler } from "@nestjs/cqrs"
import { GoogleConnectionsService } from "@modules/domain/google-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AuthorizeGoogleResult } from "./authorize-google.contracts"
import { AuthorizeGoogleCommand } from "./authorize-google.command"

@CommandHandler(AuthorizeGoogleCommand)
/** Starts the Google consent through the GoogleConnectionsService. */
export class AuthorizeGoogleHandler extends ICQRSHandler<AuthorizeGoogleCommand, AuthorizeGoogleResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly google: GoogleConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: AuthorizeGoogleCommand): Promise<AuthorizeGoogleResult> {
        return this.google.authorize(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.returnTo,
        )
    }
}
