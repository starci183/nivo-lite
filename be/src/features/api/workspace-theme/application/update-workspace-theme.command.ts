import { Command } from "@nestjs/cqrs"
import type { WorkspaceTheme } from "@modules/domain/workspace-settings"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpdateWorkspaceThemeRequest } from "./update-workspace-theme.contracts"

/** Asks to save the brand theme of the active workspace. */
export class UpdateWorkspaceThemeCommand extends Command<WorkspaceTheme | null> {
    constructor(readonly params: ExecuteParams<UpdateWorkspaceThemeRequest>) {
        super()
    }
}
