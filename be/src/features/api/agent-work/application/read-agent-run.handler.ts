import { QueryHandler } from "@nestjs/cqrs"
import { AgentRunPageService, type OptionalAgentRunDetail } from "@modules/domain/agent-pages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ReadAgentRunQuery } from "./read-agent-run.query"

@QueryHandler(ReadAgentRunQuery)
/** Answers one run of an agent to an owner or manager: its steps with their moments, tries and door calls, and the work item it is about. */
export class ReadAgentRunHandler extends ICQRSHandler<ReadAgentRunQuery, OptionalAgentRunDetail> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: AgentRunPageService,
    ) {
        super(logger)
    }

    protected override process(query: ReadAgentRunQuery): Promise<OptionalAgentRunDetail> {
        return this.page.page(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.installationId,
            query.params.request.runId,
            query.params.request.locale,
        )
    }
}
