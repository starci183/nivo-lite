import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetTelegramPageQuery } from "../../application/get-telegram-page.query"
import { GetTelegramPageInput } from "./dto/get-telegram-page.input"
import { TelegramPageType } from "./dto/telegram-page.type"
import { toGetTelegramPageRequest, toGetTelegramPageType } from "./get-telegram-page.mapper"

@Resolver()
/** GraphQL door of telegramPage. */
export class GetTelegramPageResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks for the page of a Telegram bot connection. */
    @Query(() => TelegramPageType, { name: "telegramPage" })
    async telegramPage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetTelegramPageInput,
    ): Promise<TelegramPageType> {
        const result = await this.queryBus.execute(
            new GetTelegramPageQuery({ request: toGetTelegramPageRequest(workspaceId, input), principal }),
        )
        return toGetTelegramPageType(result)
    }
}
