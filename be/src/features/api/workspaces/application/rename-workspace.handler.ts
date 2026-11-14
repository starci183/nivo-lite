import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceLobbyService } from "@modules/domain/workspaces"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RenameWorkspaceCommand } from "./rename-workspace.command"

@CommandHandler(RenameWorkspaceCommand)
/** Renames the workspace through the workspaces lobby service. */
export class RenameWorkspaceHandler extends ICQRSHandler<RenameWorkspaceCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly lobby: WorkspaceLobbyService,
    ) {
        super(logger)
    }

    protected override process(command: RenameWorkspaceCommand): Promise<void> {
        return this.lobby.rename(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.name,
        )
    }
}
