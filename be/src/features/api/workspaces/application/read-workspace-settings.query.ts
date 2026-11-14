import { Query } from "@nestjs/cqrs"
import type { WorkspaceSettings } from "@modules/domain/workspace-settings"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReadWorkspaceSettingsRequest } from "./read-workspace-settings.contracts"

/** Asks for the name, time zone and logo of the active workspace. */
export class ReadWorkspaceSettingsQuery extends Query<WorkspaceSettings> {
    constructor(readonly params: ExecuteParams<ReadWorkspaceSettingsRequest>) {
        super()
    }
}
