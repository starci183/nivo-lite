import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { LoadTelegramUserSetupQuery } from "../../application/load-telegram-user-setup.query"
import { LoadTelegramUserSetupInput } from "./dto/load-telegram-user-setup.input"
import { TelegramSetupStateType } from "./dto/telegram-setup-state.type"
import { toLoadTelegramUserSetupRequest, toLoadTelegramUserSetupType } from "./load-telegram-user-setup.mapper"

@Resolver()
/** GraphQL door of loadTelegramUserSetup. */
export class LoadTelegramUserSetupResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads where a Telegram connection wizard continues. */
    @Query(() => TelegramSetupStateType, { name: "loadTelegramUserSetup" })
    async loadTelegramUserSetup(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: LoadTelegramUserSetupInput,
    ): Promise<TelegramSetupStateType> {
        const result = await this.queryBus.execute(
            new LoadTelegramUserSetupQuery({ request: toLoadTelegramUserSetupRequest(workspaceId, input), principal }),
        )
        return toLoadTelegramUserSetupType(result)
    }
}
