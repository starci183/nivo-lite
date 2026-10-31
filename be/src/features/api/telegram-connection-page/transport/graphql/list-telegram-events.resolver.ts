import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListTelegramEventsQuery } from "../../application/list-telegram-events.query"
import { ListTelegramEventsInput } from "./dto/list-telegram-events.input"
import { TelegramEventType } from "./dto/telegram-event.type"
import { toListTelegramEventsRequest, toListTelegramEventsType } from "./list-telegram-events.mapper"

@Resolver()
/** GraphQL door of telegramEvents. */
export class ListTelegramEventsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks for the live events of a Telegram bot connection. */
    @Query(() => [TelegramEventType], { name: "telegramEvents" })
    async telegramEvents(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ListTelegramEventsInput,
    ): Promise<Array<TelegramEventType>> {
        const result = await this.queryBus.execute(
            new ListTelegramEventsQuery({ request: toListTelegramEventsRequest(workspaceId, input), principal }),
        )
        return toListTelegramEventsType(result)
    }
}
