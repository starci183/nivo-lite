import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AgentConnectionCandidatesQuery } from "../../application/agent-connection-candidates.query"
import {
    toAgentConnectionCandidatesRequest,
    toAgentConnectionCandidatesType,
} from "./agent-connection-candidates.mapper"
import { AgentConnectionCandidateType } from "./dto/agent-connection-candidate.type"
import { AgentConnectionCandidatesInput } from "./dto/agent-connection-candidates.input"

@Resolver()
/** GraphQL door of the connections an agent may be granted. */
export class AgentConnectionCandidatesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Every connection this agent is allowed to use, with the access it already has; any member may look. */
    @Query(() => [AgentConnectionCandidateType], { name: "agentConnectionCandidates" })
    async agentConnectionCandidates(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentConnectionCandidatesInput,
    ): Promise<Array<AgentConnectionCandidateType>> {
        const result = await this.queryBus.execute(
            new AgentConnectionCandidatesQuery({
                request: toAgentConnectionCandidatesRequest(workspaceId, input),
                principal,
            }),
        )
        return toAgentConnectionCandidatesType(result)
    }
}
