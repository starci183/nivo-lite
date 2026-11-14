import { QueryHandler } from "@nestjs/cqrs"
import { AgentToolLinesService, type AgentToolLine } from "@modules/domain/agent-pages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetAgentToolsQuery } from "./get-agent-tools.query"

@QueryHandler(GetAgentToolsQuery)
/** Answers what one agent can really call, to an owner or manager: its module's tools, the tools its attached accounts add and the default context reads. */
export class GetAgentToolsHandler extends ICQRSHandler<GetAgentToolsQuery, ReadonlyArray<AgentToolLine>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly tools: AgentToolLinesService,
    ) {
        super(logger)
    }

    protected override process(query: GetAgentToolsQuery): Promise<ReadonlyArray<AgentToolLine>> {
        return this.tools.lines(query.params.principal.id, query.params.request.workspaceId, query.params.request.agentId)
    }
}
