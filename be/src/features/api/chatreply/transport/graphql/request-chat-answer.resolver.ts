import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestChatAnswerCommand } from "../../application/request-chat-answer.command"
import { toRequestChatAnswerRequest, toRequestChatAnswerType } from "./request-chat-answer.mapper"
import { RequestChatAnswerInput } from "./dto/request-chat-answer.input"
import { ChatReplyProgressType } from "./dto/chat-reply-progress.type"

@Resolver()
/** Queues the decision of a waiting customer escalation. */
export class RequestChatAnswerResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues the decision of a waiting customer escalation. */
    @Mutation(() => ChatReplyProgressType, { name: "requestChatAnswer" })
    async requestChatAnswer(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestChatAnswerInput,
    ): Promise<ChatReplyProgressType> {
        const result = await this.commandBus.execute(
            new RequestChatAnswerCommand({ request: toRequestChatAnswerRequest(workspaceId, input), principal }),
        )
        return toRequestChatAnswerType(result)
    }
}
