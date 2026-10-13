import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { TelegramUserReadyQuery } from "../../application/telegram-user-ready.query"
import { TelegramUserReadyType } from "./dto/telegram-user-ready.type"
import { toTelegramUserReadyRequest, toTelegramUserReadyType } from "./telegram-user-ready.mapper"

@Resolver()
/** GraphQL door of telegramUserReady. */
export class TelegramUserReadyResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks whether this deployment can log in a personal Telegram account. */
    @Query(() => TelegramUserReadyType, { name: "telegramUserReady" })
    async telegramUserReady(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<TelegramUserReadyType> {
        const result = await this.queryBus.execute(
            new TelegramUserReadyQuery({ request: toTelegramUserReadyRequest(workspaceId), principal }),
        )
        return toTelegramUserReadyType(result)
    }
}
