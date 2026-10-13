import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ChatReplyStatusQuery } from "../../application/chat-reply-status.query"
import { toChatReplyStatusRequest, toChatReplyStatusType } from "./chat-reply-status.mapper"
import { ChatReplyStatusInput } from "./dto/chat-reply-status.input"
import { ChatReplyProgressType } from "./dto/chat-reply-progress.type"

@Resolver()
/** Reads the delivery progress of a stored human reply. */
export class ChatReplyStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the delivery progress of a stored human reply. */
    @Query(() => ChatReplyProgressType, { name: "chatReplyStatus" })
    async chatReplyStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatReplyStatusInput,
    ): Promise<ChatReplyProgressType> {
        const result = await this.queryBus.execute(
            new ChatReplyStatusQuery({ request: toChatReplyStatusRequest(workspaceId, input), principal }),
        )
        return toChatReplyStatusType(result)
    }
}
