import { CommandHandler } from "@nestjs/cqrs"
import { DriveGrantService } from "@modules/domain/google-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AuthorizeDriveCommand } from "./authorize-drive.command"
import type { AuthorizeDriveResult } from "./authorize-drive.contracts"

@CommandHandler(AuthorizeDriveCommand)
/** Starts the Google Drive read consent through the DriveGrantService. */
export class AuthorizeDriveHandler extends ICQRSHandler<AuthorizeDriveCommand, AuthorizeDriveResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly drive: DriveGrantService,
    ) {
        super(logger)
    }

    protected override process(command: AuthorizeDriveCommand): Promise<AuthorizeDriveResult> {
        return this.drive.authorize(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.returnTo,
        )
    }
}
