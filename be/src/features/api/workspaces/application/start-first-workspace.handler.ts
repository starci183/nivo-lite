import { CommandHandler } from "@nestjs/cqrs"
import { WorkspacesService } from "@modules/domain/workspaces"
import type { FirstWorkspace } from "@modules/domain/workspaces"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { StartFirstWorkspaceCommand } from "./start-first-workspace.command"

@CommandHandler(StartFirstWorkspaceCommand)
/** Starts the caller's first workspace through the workspaces service. */
export class StartFirstWorkspaceHandler extends ICQRSHandler<StartFirstWorkspaceCommand, FirstWorkspace> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly workspaces: WorkspacesService,
    ) {
        super(logger)
    }

    protected override process(command: StartFirstWorkspaceCommand): Promise<FirstWorkspace> {
        return this.workspaces.startFirst(command.params.principal.id)
    }
}
