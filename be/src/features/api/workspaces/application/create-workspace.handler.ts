import { CommandHandler } from "@nestjs/cqrs"
import { WorkspacesService } from "@modules/domain/workspaces"
import type { CreatedWorkspace } from "@modules/domain/workspaces"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateWorkspaceCommand } from "./create-workspace.command"

@CommandHandler(CreateWorkspaceCommand)
/** Creates a free workspace for the caller through the workspaces service. */
export class CreateWorkspaceHandler extends ICQRSHandler<CreateWorkspaceCommand, CreatedWorkspace> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly workspaces: WorkspacesService,
    ) {
        super(logger)
    }

    protected override process(command: CreateWorkspaceCommand): Promise<CreatedWorkspace> {
        return this.workspaces.createFree(command.params.principal.id, command.params.request.name)
    }
}
