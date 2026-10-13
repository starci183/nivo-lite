import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ChatAnswerStatusQuery } from "../../application/chat-answer-status.query"
import { toChatAnswerStatusRequest, toChatAnswerStatusType } from "./chat-answer-status.mapper"
import { ChatAnswerStatusInput } from "./dto/chat-answer-status.input"
import { ChatReplyProgressType } from "./dto/chat-reply-progress.type"

@Resolver()
/** Reads the queued escalation decision and its answer delivery. */
export class ChatAnswerStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the queued escalation decision and its answer delivery. */
    @Query(() => ChatReplyProgressType, { name: "chatAnswerStatus" })
    async chatAnswerStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatAnswerStatusInput,
    ): Promise<ChatReplyProgressType> {
        const result = await this.queryBus.execute(
            new ChatAnswerStatusQuery({ request: toChatAnswerStatusRequest(workspaceId, input), principal }),
        )
        return toChatAnswerStatusType(result)
    }
}
