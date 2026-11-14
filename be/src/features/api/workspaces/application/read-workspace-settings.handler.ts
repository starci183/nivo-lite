import { QueryHandler } from "@nestjs/cqrs"
import { WorkspaceSettingsAccessService, type WorkspaceSettings } from "@modules/domain/workspace-settings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ReadWorkspaceSettingsQuery } from "./read-workspace-settings.query"

@QueryHandler(ReadWorkspaceSettingsQuery)
/** Answers the workspace settings to any member through the workspace settings door. */
export class ReadWorkspaceSettingsHandler extends ICQRSHandler<ReadWorkspaceSettingsQuery, WorkspaceSettings> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly settings: WorkspaceSettingsAccessService,
    ) {
        super(logger)
    }

    protected override process(query: ReadWorkspaceSettingsQuery): Promise<WorkspaceSettings> {
        return this.settings.read(query.params.principal.id, query.params.request.workspaceId)
    }
}
