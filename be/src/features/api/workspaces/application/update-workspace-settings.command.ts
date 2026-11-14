import { Command } from "@nestjs/cqrs"
import type { WorkspaceSettings } from "@modules/domain/workspace-settings"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpdateWorkspaceSettingsRequest } from "./update-workspace-settings.contracts"

/** Asks to change the name, time zone or logo of the active workspace. */
export class UpdateWorkspaceSettingsCommand extends Command<WorkspaceSettings> {
    constructor(readonly params: ExecuteParams<UpdateWorkspaceSettingsRequest>) {
        super()
    }
}
