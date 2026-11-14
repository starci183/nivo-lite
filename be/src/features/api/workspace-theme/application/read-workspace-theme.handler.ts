import { QueryHandler } from "@nestjs/cqrs"
import { WorkspaceThemeAccessService, type WorkspaceTheme } from "@modules/domain/workspace-settings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ReadWorkspaceThemeQuery } from "./read-workspace-theme.query"

@QueryHandler(ReadWorkspaceThemeQuery)
/** Answers the workspace theme to any member through the workspace settings door. */
export class ReadWorkspaceThemeHandler extends ICQRSHandler<ReadWorkspaceThemeQuery, WorkspaceTheme | null> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly settings: WorkspaceThemeAccessService,
    ) {
        super(logger)
    }

    protected override process(query: ReadWorkspaceThemeQuery): Promise<WorkspaceTheme | null> {
        return this.settings.readTheme(query.params.principal.id, query.params.request.workspaceId)
    }
}
