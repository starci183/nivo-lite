import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListAgentGraphCoverageQuery } from "../../application/list-agent-graph-coverage.query"
import { AgentGraphCoverageType } from "./dto/agent-graph-coverage.type"
import { ListAgentGraphCoverageInput } from "./dto/list-agent-graph-coverage.input"

@Resolver()
/** GraphQL door of agentGraphCoverage. */
export class ListAgentGraphCoverageResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists who can answer each ask of the graph of one agent, and who was left out and why. */
    @Query(() => [AgentGraphCoverageType], { name: "agentGraphCoverage" })
    agentGraphCoverage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ListAgentGraphCoverageInput,
    ): Promise<ReadonlyArray<AgentGraphCoverageType>> {
        return this.queryBus.execute(
            new ListAgentGraphCoverageQuery({ request: { workspaceId, agentId: input.agentId }, principal }),
        )
    }
}
