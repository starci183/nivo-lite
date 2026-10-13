import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetAgentChatTurnStatusQuery } from "../../application/agent-chat-turn-status.query"
import { toGetAgentChatTurnStatusRequest, toGetAgentChatTurnStatusType } from "./agent-chat-turn-status.mapper"
import { AgentChatTurnStatusInput } from "./dto/agent-chat-turn-status.input"
import { AgentChatTurnStatusType } from "./dto/agent-chat-turn-status.type"

@Resolver()
/** The GraphQL door for agentChatTurnStatus. */
export class GetAgentChatTurnStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Runs agentChatTurnStatus under the verified caller. */
    @Query(() => AgentChatTurnStatusType, { name: "agentChatTurnStatus" })
    async agentChatTurnStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentChatTurnStatusInput,
    ): Promise<AgentChatTurnStatusType> {
        const result = await this.queryBus.execute(
            new GetAgentChatTurnStatusQuery({
                request: toGetAgentChatTurnStatusRequest(workspaceId, input),
                principal,
            }),
        )
        return toGetAgentChatTurnStatusType(result)
    }
}
