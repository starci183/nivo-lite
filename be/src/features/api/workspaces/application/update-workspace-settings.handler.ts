import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceSettingsAccessService, type WorkspaceSettings } from "@modules/domain/workspace-settings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { UpdateWorkspaceSettingsCommand } from "./update-workspace-settings.command"

@CommandHandler(UpdateWorkspaceSettingsCommand)
/** Changes the workspace settings for an owner or a manager through the workspace settings door. */
export class UpdateWorkspaceSettingsHandler extends ICQRSHandler<UpdateWorkspaceSettingsCommand, WorkspaceSettings> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly settings: WorkspaceSettingsAccessService,
    ) {
        super(logger)
    }

    protected override process(command: UpdateWorkspaceSettingsCommand): Promise<WorkspaceSettings> {
        return this.settings.change(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.edit,
        )
    }
}
