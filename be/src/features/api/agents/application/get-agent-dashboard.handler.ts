import { QueryHandler } from "@nestjs/cqrs"
import { AgentsService } from "@modules/domain/agents"
import type { AgentDashboardData } from "@modules/domain/agents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetAgentDashboardQuery } from "./get-agent-dashboard.query"

@QueryHandler(GetAgentDashboardQuery)
/** Answers the dashboard regions from the agents service. */
export class GetAgentDashboardHandler extends ICQRSHandler<GetAgentDashboardQuery, AgentDashboardData> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly agents: AgentsService,
    ) {
        super(logger)
    }

    protected override process(query: GetAgentDashboardQuery): Promise<AgentDashboardData> {
        return this.agents.dashboard(query.params.principal.id, query.params.request)
    }
}
