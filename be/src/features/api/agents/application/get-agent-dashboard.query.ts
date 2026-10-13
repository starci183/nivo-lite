import { Query } from "@nestjs/cqrs"
import type { AgentDashboardData } from "@modules/domain/agents"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetAgentDashboardRequest } from "./get-agent-dashboard.contracts"

/** Asks for the dashboard of one module's agent. */
export class GetAgentDashboardQuery extends Query<AgentDashboardData> {
    constructor(readonly params: ExecuteParams<GetAgentDashboardRequest>) {
        super()
    }
}
