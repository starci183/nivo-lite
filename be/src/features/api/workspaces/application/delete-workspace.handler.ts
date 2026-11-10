import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceDeletionService } from "@modules/domain/workspace-invites"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DeleteWorkspaceCommand } from "./delete-workspace.command"

@CommandHandler(DeleteWorkspaceCommand)
/** Deletes the workspace as its owner through the deletion service. */
export class DeleteWorkspaceHandler extends ICQRSHandler<DeleteWorkspaceCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly deletion: WorkspaceDeletionService,
    ) {
        super(logger)
    }

    protected override process(command: DeleteWorkspaceCommand): Promise<void> {
        return this.deletion.remove(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.confirmName,
        )
    }
}
