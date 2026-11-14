import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceDeletionService } from "@modules/domain/workspace-invites"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RestoreWorkspaceCommand } from "./restore-workspace.command"

@CommandHandler(RestoreWorkspaceCommand)
/** Restores the deleted workspace as its owner through the deletion service. */
export class RestoreWorkspaceHandler extends ICQRSHandler<RestoreWorkspaceCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly deletion: WorkspaceDeletionService,
    ) {
        super(logger)
    }

    protected override process(command: RestoreWorkspaceCommand): Promise<void> {
        return this.deletion.restore(command.params.principal.id, command.params.request.workspaceId)
    }
}
