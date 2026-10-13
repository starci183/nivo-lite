import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetChatbotThreadQuery } from "../../application/get-chatbot-thread.query"
import { ChatbotThreadInput } from "./dto/chatbot-thread.input"
import { ChatbotThreadType } from "./dto/chatbot-thread.type"
import { toChatbotThreadRequest, toChatbotThreadType } from "./chatbot-thread.mapper"

@Resolver()
/** GraphQL door for the caller's Chatbot thread. */
export class ChatbotThreadResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the thread within the caller's selected workspace. */
    @Query(() => ChatbotThreadType, { name: "chatbotThread" })
    async chatbotThread(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatbotThreadInput,
    ): Promise<ChatbotThreadType> {
        const result = await this.queryBus.execute(
            new GetChatbotThreadQuery({ request: toChatbotThreadRequest(workspaceId, input), principal }),
        )
        return toChatbotThreadType(result)
    }
}
