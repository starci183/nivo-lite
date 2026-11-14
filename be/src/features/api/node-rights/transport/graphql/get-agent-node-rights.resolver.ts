import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { GetAgentNodeRightsQuery } from "../../application/get-agent-node-rights.query"
import { GetAgentNodeRightsInput } from "./dto/get-agent-node-rights.input"
import { AgentNodeRightsType } from "./dto/get-agent-node-rights.type"
import { toGetAgentNodeRightsRequest, toAgentNodeRightsType } from "./get-agent-node-rights.mapper"

@Resolver()
/** GraphQL door of agentNodeRights. */
export class GetAgentNodeRightsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The rights page of one agent: its attached accounts and what its running workflow nodes call on them. Any member; read-only; no live provider call. */
    @Query(() => AgentNodeRightsType, { name: "agentNodeRights" })
    async agentNodeRights(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetAgentNodeRightsInput,
    ): Promise<AgentNodeRightsType> {
        const answer = await this.queryBus.execute(
            new GetAgentNodeRightsQuery({ request: toGetAgentNodeRightsRequest(workspaceId, input), principal }),
        )
        return toAgentNodeRightsType(answer)
    }
}
