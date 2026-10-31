import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ReadAgentWorkQuery } from "../../application/read-agent-work.query"
import { ReadWorkspaceAgentWorkQuery } from "../../application/read-workspace-agent-work.query"
import { toAgentWorkType, toReadAgentWorkRequest, toWorkspaceAgentWorkType } from "./agent-work.mapper"
import { AgentWorkInstanceInput } from "./dto/agent-work-instance.input"
import { AgentWorkType } from "./dto/agent-work.type"
import { WorkspaceAgentWorkType } from "./dto/workspace-agent-work.type"

@Resolver()
/** GraphQL doors that read the Work tab of an agent and the workspace switch; staff are refused. */
export class AgentWorkResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The work of one agent: its switch, goals, open tasks, triggers, the next run and the last 20 turns. */
    @Query(() => AgentWorkType, { name: "agentWork" })
    async agentWork(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentWorkInstanceInput,
    ): Promise<AgentWorkType> {
        const result = await this.queryBus.execute(
            new ReadAgentWorkQuery({ request: toReadAgentWorkRequest(workspaceId, input), principal }),
        )
        return toAgentWorkType(result)
    }

    /** The switch of the whole workspace with the counts beside it. */
    @Query(() => WorkspaceAgentWorkType, { name: "workspaceAgentWork" })
    async workspaceAgentWork(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<WorkspaceAgentWorkType> {
        const result = await this.queryBus.execute(
            new ReadWorkspaceAgentWorkQuery({ request: { workspaceId }, principal }),
        )
        return toWorkspaceAgentWorkType(result)
    }
}
