import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListAgentGraphRunsQuery } from "../../application/list-agent-graph-runs.query"
import { AgentGraphRunEntryType } from "./dto/agent-graph-run-entry.type"
import { ListAgentGraphRunsInput } from "./dto/list-agent-graph-runs.input"

@Resolver()
/** GraphQL door of agentGraphRuns. */
export class ListAgentGraphRunsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists what ran against the graph of an agent, newest first. */
    @Query(() => [AgentGraphRunEntryType], { name: "agentGraphRuns" })
    agentGraphRuns(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ListAgentGraphRunsInput,
    ): Promise<ReadonlyArray<AgentGraphRunEntryType>> {
        return this.queryBus.execute(
            new ListAgentGraphRunsQuery({
                request: { workspaceId, agentId: input.agentId, limit: input.limit },
                principal,
            }),
        )
    }
}
