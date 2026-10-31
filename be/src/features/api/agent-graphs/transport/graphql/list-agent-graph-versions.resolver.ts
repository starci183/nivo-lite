import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListAgentGraphVersionsQuery } from "../../application/list-agent-graph-versions.query"
import { AgentGraphVersionType } from "./dto/agent-graph-version.type"
import { ListAgentGraphVersionsInput } from "./dto/list-agent-graph-versions.input"

@Resolver()
/** GraphQL door of listAgentGraphVersions. */
export class ListAgentGraphVersionsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The listAgentGraphVersions query. */
    @Query(() => [AgentGraphVersionType], { name: "listAgentGraphVersions" })
    listAgentGraphVersions(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ListAgentGraphVersionsInput,
    ): Promise<ReadonlyArray<AgentGraphVersionType>> {
        return this.queryBus.execute(new ListAgentGraphVersionsQuery({ request: { workspaceId, agentId: input.agentId }, principal }))
    }
}
