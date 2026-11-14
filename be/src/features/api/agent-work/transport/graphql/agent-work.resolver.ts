import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { ReadAgentWorkLogQuery } from "../../application/read-agent-work-log.query"
import { ReadAgentWorkQuery } from "../../application/read-agent-work.query"
import { ReadWorkspaceAgentWorkQuery } from "../../application/read-workspace-agent-work.query"
import {
    toAgentWorkLogTypes,
    toAgentWorkType,
    toReadAgentWorkLogRequest,
    toReadAgentWorkRequest,
    toWorkspaceAgentWorkType,
} from "./agent-work.mapper"
import { AgentWorkInstanceInput } from "./dto/agent-work-instance.input"
import { AgentWorkLogLineType } from "./dto/agent-work-log.type"
import { AgentWorkType } from "./dto/agent-work.type"
import { WorkspaceAgentWorkType } from "./dto/workspace-agent-work.type"

@Resolver()
/** GraphQL doors that read the Work tab of an agent and the workspace switch; staff are refused. */
export class AgentWorkResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The work of one agent: its switch, open tasks, triggers, the next run and the last 20 turns. */
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

    /** The work log of one agent: its newest work items with the connection, level, evidence and steps of each. */
    @Query(() => [AgentWorkLogLineType], { name: "agentWorkLog" })
    async agentWorkLog(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentWorkInstanceInput,
    ): Promise<Array<AgentWorkLogLineType>> {
        const lines = await this.queryBus.execute(
            new ReadAgentWorkLogQuery({ request: toReadAgentWorkLogRequest(workspaceId, input), principal }),
        )
        return toAgentWorkLogTypes(lines)
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
