import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetChatHandlingCommand } from "../../application/set-chat-handling.command"
import { toSetChatHandlingRequest, toSetChatHandlingType } from "./set-chat-handling.mapper"
import { SetChatHandlingInput } from "./dto/set-chat-handling.input"
import { ChatHandlingType } from "./dto/chat-handling.type"

@Resolver()
/** Takes over a customer conversation or releases it to the AI. */
export class SetChatHandlingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Takes over a customer conversation or releases it to the AI. */
    @Mutation(() => ChatHandlingType, { name: "setChatHandling" })
    async setChatHandling(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetChatHandlingInput,
    ): Promise<ChatHandlingType> {
        const result = await this.commandBus.execute(
            new SetChatHandlingCommand({ request: toSetChatHandlingRequest(workspaceId, input), principal }),
        )
        return toSetChatHandlingType(result)
    }
}
