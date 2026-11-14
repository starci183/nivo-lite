import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceThemeAccessService } from "@modules/domain/workspace-settings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ResetWorkspaceThemeCommand } from "./reset-workspace-theme.command"

@CommandHandler(ResetWorkspaceThemeCommand)
/** Returns the workspace to the NIVO default theme for an owner or a manager. */
export class ResetWorkspaceThemeHandler extends ICQRSHandler<ResetWorkspaceThemeCommand, boolean> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly settings: WorkspaceThemeAccessService,
    ) {
        super(logger)
    }

    protected override process(command: ResetWorkspaceThemeCommand): Promise<boolean> {
        return this.settings.resetTheme(command.params.principal.id, command.params.request.workspaceId)
    }
}
