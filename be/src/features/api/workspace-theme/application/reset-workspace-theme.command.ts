import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ResetWorkspaceThemeRequest } from "./reset-workspace-theme.contracts"

/** Asks to return the active workspace to the NIVO default theme. */
export class ResetWorkspaceThemeCommand extends Command<boolean> {
    constructor(readonly params: ExecuteParams<ResetWorkspaceThemeRequest>) {
        super()
    }
}
