import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { StartTelegramLoginCommand } from "../../application/start-telegram-login.command"
import { StartTelegramLoginInput } from "./dto/start-telegram-login.input"
import { TelegramLoginStartedType } from "./dto/telegram-login-started.type"
import { toStartTelegramLoginRequest, toStartTelegramLoginType } from "./start-telegram-login.mapper"

@Resolver()
/** GraphQL door of startTelegramLogin. */
export class StartTelegramLoginResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Sends the Telegram login code. */
    @Mutation(() => TelegramLoginStartedType, { name: "startTelegramLogin" })
    async startTelegramLogin(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: StartTelegramLoginInput,
    ): Promise<TelegramLoginStartedType> {
        const result = await this.commandBus.execute(
            new StartTelegramLoginCommand({ request: toStartTelegramLoginRequest(workspaceId, input), principal }),
        )
        return toStartTelegramLoginType(result)
    }
}
