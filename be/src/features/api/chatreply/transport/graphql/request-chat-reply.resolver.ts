import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestChatReplyCommand } from "../../application/request-chat-reply.command"
import { toRequestChatReplyRequest, toRequestChatReplyType } from "./request-chat-reply.mapper"
import { RequestChatReplyInput } from "./dto/request-chat-reply.input"
import { ChatReplyProgressType } from "./dto/chat-reply-progress.type"

@Resolver()
/** Stores a member reply and queues its delivery. */
export class RequestChatReplyResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Stores a member reply and queues its delivery. */
    @Mutation(() => ChatReplyProgressType, { name: "requestChatReply" })
    async requestChatReply(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestChatReplyInput,
    ): Promise<ChatReplyProgressType> {
        const result = await this.commandBus.execute(
            new RequestChatReplyCommand({ request: toRequestChatReplyRequest(workspaceId, input), principal }),
        )
        return toRequestChatReplyType(result)
    }
}
