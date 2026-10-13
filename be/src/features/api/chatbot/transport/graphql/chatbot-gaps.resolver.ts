import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetChatbotGapsQuery } from "../../application/get-chatbot-gaps.query"
import { ChatbotGapsType } from "./dto/chatbot-gaps.type"
import { toChatbotGapsRequest, toChatbotGapsType } from "./chatbot-gaps.mapper"

@Resolver()
/** GraphQL door for the caller's Chatbot gaps. */
export class ChatbotGapsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the gaps within the caller's selected workspace. */
    @Query(() => ChatbotGapsType, { name: "chatbotGaps" })
    async chatbotGaps(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<ChatbotGapsType> {
        const result = await this.queryBus.execute(
            new GetChatbotGapsQuery({ request: toChatbotGapsRequest(workspaceId), principal }),
        )
        return toChatbotGapsType(result)
    }
}
