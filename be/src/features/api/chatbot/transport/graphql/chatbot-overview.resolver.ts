import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetChatbotOverviewQuery } from "../../application/get-chatbot-overview.query"
import { ChatbotOverviewInput } from "./dto/chatbot-overview.input"
import { ChatbotOverviewType } from "./dto/chatbot-overview.type"
import { toChatbotOverviewRequest, toChatbotOverviewType } from "./chatbot-overview.mapper"

@Resolver()
/** GraphQL door for the caller's Chatbot overview. */
export class ChatbotOverviewResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the overview within the caller's selected workspace. */
    @Query(() => ChatbotOverviewType, { name: "chatbotOverview" })
    async chatbotOverview(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatbotOverviewInput,
    ): Promise<ChatbotOverviewType> {
        const result = await this.queryBus.execute(
            new GetChatbotOverviewQuery({ request: toChatbotOverviewRequest(workspaceId, input), principal }),
        )
        return toChatbotOverviewType(result)
    }
}
