import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListTelegramChatsQuery } from "../../application/list-telegram-chats.query"
import { ListTelegramChatsInput } from "./dto/list-telegram-chats.input"
import { TelegramChatChoiceType } from "./dto/telegram-chat-choice.type"
import { toListTelegramChatsRequest, toListTelegramChatsType } from "./list-telegram-chats.mapper"

@Resolver()
/** GraphQL door of listTelegramChats. */
export class ListTelegramChatsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the recent chats of a Telegram account. */
    @Query(() => [TelegramChatChoiceType], { name: "listTelegramChats" })
    async listTelegramChats(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ListTelegramChatsInput,
    ): Promise<ReadonlyArray<TelegramChatChoiceType>> {
        const result = await this.queryBus.execute(
            new ListTelegramChatsQuery({ request: toListTelegramChatsRequest(workspaceId, input), principal }),
        )
        return toListTelegramChatsType(result)
    }
}
