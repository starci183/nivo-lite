import { QueryHandler } from "@nestjs/cqrs"
import { AgentRunBoardService } from "@modules/domain/agent-pages"
import type { AgentRunsBoard } from "@modules/domain/agent-work"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ReadAgentRunsQuery } from "./read-agent-runs.query"

@QueryHandler(ReadAgentRunsQuery)
/** Answers the runs of one agent to an owner or manager: the newest runs with their progress, the workflows they ran and what waits. */
export class ReadAgentRunsHandler extends ICQRSHandler<ReadAgentRunsQuery, AgentRunsBoard> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly board: AgentRunBoardService,
    ) {
        super(logger)
    }

    protected override process(query: ReadAgentRunsQuery): Promise<AgentRunsBoard> {
        return this.board.board(query.params.principal.id, query.params.request.workspaceId, query.params.request.installationId)
    }
}
