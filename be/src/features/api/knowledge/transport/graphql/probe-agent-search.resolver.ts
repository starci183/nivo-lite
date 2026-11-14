import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { ProbeAgentSearchQuery } from "../../application/probe-agent-search.query"
import { AgentSearchProbeType } from "./dto/agent-search-probe.type"
import { ProbeAgentSearchInput } from "./dto/probe-agent-search.input"
import { toAgentSearchProbeType, toProbeAgentSearchRequest } from "./probe-agent-search.mapper"

@Resolver()
/** GraphQL door of runs one Brain read tool as an agent, for the workspace owner. */
export class ProbeAgentSearchResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Runs one Brain read tool as an agent, with no model turn: what that agent's search really finds. Owner only. */
    @Query(() => AgentSearchProbeType, { name: "probeAgentSearch" })
    async probeAgentSearch(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ProbeAgentSearchInput,
    ): Promise<AgentSearchProbeType> {
        const result = await this.queryBus.execute(
            new ProbeAgentSearchQuery({ request: toProbeAgentSearchRequest(workspaceId, input), principal }),
        )
        return toAgentSearchProbeType(result)
    }
}
