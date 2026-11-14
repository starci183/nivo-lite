import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkLogService, type WorkLogLine } from "@modules/domain/agent-pages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ReadAgentWorkLogQuery } from "./read-agent-work-log.query"

@QueryHandler(ReadAgentWorkLogQuery)
/** Answers the work log of one agent to an owner or manager: its newest work items, each with how it was decided and what backs it. */
export class ReadAgentWorkLogHandler extends ICQRSHandler<ReadAgentWorkLogQuery, ReadonlyArray<WorkLogLine>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly log: AgentWorkLogService,
    ) {
        super(logger)
    }

    protected override process(query: ReadAgentWorkLogQuery): Promise<ReadonlyArray<WorkLogLine>> {
        return this.log.lines(query.params.principal.id, query.params.request.workspaceId, query.params.request.installationId)
    }
}
