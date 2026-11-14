import { Query } from "@nestjs/cqrs"
import type { WorkspaceTheme } from "@modules/domain/workspace-settings"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReadWorkspaceThemeRequest } from "./read-workspace-theme.contracts"

/** Asks for the brand theme of the active workspace; null while it wears the NIVO default. */
export class ReadWorkspaceThemeQuery extends Query<WorkspaceTheme | null> {
    constructor(readonly params: ExecuteParams<ReadWorkspaceThemeRequest>) {
        super()
    }
}
