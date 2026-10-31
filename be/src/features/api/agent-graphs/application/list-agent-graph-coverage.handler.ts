import { QueryHandler } from "@nestjs/cqrs"
import { AgentGraphAdminService } from "@modules/domain/agent-graphs"
import type { AskCoverage } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListAgentGraphCoverageQuery } from "./list-agent-graph-coverage.query"

@QueryHandler(ListAgentGraphCoverageQuery)
/** Lists who can answer each ask of the graph of one agent, and who was left out and why. The admin service checks the owner or manager role. */
export class ListAgentGraphCoverageHandler extends ICQRSHandler<ListAgentGraphCoverageQuery, ReadonlyArray<AskCoverage>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentGraphAdminService,
    ) {
        super(logger)
    }

    protected override process(command: ListAgentGraphCoverageQuery): Promise<ReadonlyArray<AskCoverage>> {
        return this.admin.coverage({ workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id }, command.params.request.agentId)
    }
}
