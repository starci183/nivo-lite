import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceThemeAccessService, type WorkspaceTheme } from "@modules/domain/workspace-settings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { UpdateWorkspaceThemeCommand } from "./update-workspace-theme.command"

@CommandHandler(UpdateWorkspaceThemeCommand)
/** Saves the workspace theme for an owner or a manager through the workspace settings door. */
export class UpdateWorkspaceThemeHandler extends ICQRSHandler<UpdateWorkspaceThemeCommand, WorkspaceTheme | null> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly settings: WorkspaceThemeAccessService,
    ) {
        super(logger)
    }

    protected override process(command: UpdateWorkspaceThemeCommand): Promise<WorkspaceTheme | null> {
        return this.settings.updateTheme(command.params.principal.id, command.params.request)
    }
}
