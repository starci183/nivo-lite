import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetAgentChatPageQuery } from "../../application/agent-chat-page.query"
import { toGetAgentChatPageRequest, toGetAgentChatPageType } from "./agent-chat-page.mapper"
import { AgentChatPageInput } from "./dto/agent-chat-page.input"
import { AgentChatPageType } from "./dto/agent-chat-page.type"

@Resolver()
/** The GraphQL door for agentChatPage. */
export class GetAgentChatPageResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Runs agentChatPage under the verified caller. */
    @Query(() => AgentChatPageType, { name: "agentChatPage" })
    async agentChatPage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentChatPageInput,
    ): Promise<AgentChatPageType> {
        const result = await this.queryBus.execute(
            new GetAgentChatPageQuery({ request: toGetAgentChatPageRequest(workspaceId, input), principal }),
        )
        return toGetAgentChatPageType(result)
    }
}
