import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceSetupService } from "@modules/domain/modules"
import type { FirstWorkspace } from "@modules/domain/workspaces"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { StartFirstWorkspaceCommand } from "./start-first-workspace.command"

@CommandHandler(StartFirstWorkspaceCommand)
/** Starts the caller's first workspace through the workspace setup, so it starts with its governance. */
export class StartFirstWorkspaceHandler extends ICQRSHandler<StartFirstWorkspaceCommand, FirstWorkspace> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: WorkspaceSetupService,
    ) {
        super(logger)
    }

    protected override process(command: StartFirstWorkspaceCommand): Promise<FirstWorkspace> {
        return this.setup.startFirst(command.params.principal.id)
    }
}
