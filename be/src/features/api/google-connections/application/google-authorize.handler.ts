import { CommandHandler } from "@nestjs/cqrs"
import { GoogleConnectionsService } from "@modules/domain/google-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GoogleAuthorizeCommand } from "./google-authorize.command"
import type { GoogleAuthorizeResult } from "./google-authorize.contracts"

@CommandHandler(GoogleAuthorizeCommand)
/** Starts the Google consent and answers the Google url. */
export class GoogleAuthorizeHandler extends ICQRSHandler<GoogleAuthorizeCommand, GoogleAuthorizeResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly googleConnectionsService: GoogleConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: GoogleAuthorizeCommand): Promise<GoogleAuthorizeResult> {
        const { request } = command.params
        return this.googleConnectionsService.authorize(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.returnTo,
        )
    }
}
