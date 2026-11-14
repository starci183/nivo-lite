import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { AcceptedLocale, type Locale } from "@modules/platform/i18n"
import { ReadAgentRunQuery } from "../../application/read-agent-run.query"
import { ReadAgentRunsQuery } from "../../application/read-agent-runs.query"
import {
    toAgentRunDetailType,
    toAgentRunsType,
    toReadAgentRunRequest,
    toReadAgentRunsRequest,
} from "./agent-runs.mapper"
import { AgentRunDetailType } from "./dto/agent-run-detail.type"
import { AgentRunInput } from "./dto/agent-run.input"
import { AgentRunsType } from "./dto/agent-run.type"
import { AgentWorkInstanceInput } from "./dto/agent-work-instance.input"

@Resolver()
/** GraphQL doors that read the runs of an agent for its Work tab: the list and one run with its steps; staff are refused. */
export class AgentRunsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The runs of one agent: the newest, their workflows and what is running and queued. */
    @Query(() => AgentRunsType, { name: "agentRuns" })
    async agentRuns(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentWorkInstanceInput,
    ): Promise<AgentRunsType> {
        const board = await this.queryBus.execute(
            new ReadAgentRunsQuery({ request: toReadAgentRunsRequest(workspaceId, input), principal }),
        )
        return toAgentRunsType(board)
    }

    /** One run of an agent with its steps and the work item it is about; null when the agent has no such run. */
    @Query(() => AgentRunDetailType, { name: "agentRun", nullable: true })
    async agentRun(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentRunInput,
        @AcceptedLocale() locale: Locale,
    ): Promise<AgentRunDetailType | null> {
        const detail = await this.queryBus.execute(
            new ReadAgentRunQuery({ request: toReadAgentRunRequest(workspaceId, input, locale), principal }),
        )
        return toAgentRunDetailType(detail)
    }
}
