import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceSetupService } from "@modules/domain/modules"
import type { CreatedWorkspace } from "@modules/domain/workspaces"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateWorkspaceCommand } from "./create-workspace.command"

@CommandHandler(CreateWorkspaceCommand)
/** Creates a free workspace for the caller with its starting governance (authority sheet and default rules). */
export class CreateWorkspaceHandler extends ICQRSHandler<CreateWorkspaceCommand, CreatedWorkspace> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: WorkspaceSetupService,
    ) {
        super(logger)
    }

    protected override process(command: CreateWorkspaceCommand): Promise<CreatedWorkspace> {
        return this.setup.createFree(command.params.principal.id, command.params.request.name)
    }
}
