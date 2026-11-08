import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkDoorsService, type WorkspaceAgentWorkView } from "@modules/domain/agent-work"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ReadWorkspaceAgentWorkQuery } from "./read-workspace-agent-work.query"

@QueryHandler(ReadWorkspaceAgentWorkQuery)
/** Answers the workspace switch and counts to an owner or manager. */
export class ReadWorkspaceAgentWorkHandler extends ICQRSHandler<ReadWorkspaceAgentWorkQuery, WorkspaceAgentWorkView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly doors: AgentWorkDoorsService,
    ) {
        super(logger)
    }

    protected override process(query: ReadWorkspaceAgentWorkQuery): Promise<WorkspaceAgentWorkView> {
        return this.doors.workspaceWork(query.params.principal.id, query.params.request.workspaceId)
    }
}
