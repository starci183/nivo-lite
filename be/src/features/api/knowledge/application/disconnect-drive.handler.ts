import { CommandHandler } from "@nestjs/cqrs"
import { DriveGrantService } from "@modules/domain/google-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DisconnectDriveCommand } from "./disconnect-drive.command"

@CommandHandler(DisconnectDriveCommand)
/** Forgets the Google Drive read grant through the DriveGrantService. */
export class DisconnectDriveHandler extends ICQRSHandler<DisconnectDriveCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly drive: DriveGrantService,
    ) {
        super(logger)
    }

    protected override process(command: DisconnectDriveCommand): Promise<void> {
        return this.drive.disconnect({
            principalId: command.params.principal.id,
            workspaceId: command.params.request.workspaceId,
        })
    }
}
