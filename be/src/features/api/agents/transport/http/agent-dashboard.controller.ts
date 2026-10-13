import { Controller, Get, Query } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetAgentDashboardQuery } from "../../application/get-agent-dashboard.query"
import { toDashboardRequest, toDashboardResponse } from "./agents.mapper"
import { AgentDashboardRequest } from "./dto/agent-dashboard.request"
import { AgentDashboardResponse } from "./dto/agent-dashboard.response"

@Controller("agents/dashboard")
/** HTTP door of the dashboard of one module's agent. */
export class AgentDashboardController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the regions of the dashboard; a region that fails is reported in place and never fails the page. */
    @Get()
    async dashboard(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Query() query: AgentDashboardRequest,
    ): Promise<AgentDashboardResponse> {
        const result = await this.queryBus.execute(
            new GetAgentDashboardQuery({ request: toDashboardRequest(workspaceId, query), principal }),
        )
        return toDashboardResponse(result)
    }
}
