import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ConnectTelegramCommand } from "../../application/connect-telegram.command"
import { ConnectTelegramInput } from "./dto/connect-telegram.input"
import { TelegramConnectedType } from "./dto/telegram-connected.type"
import { toConnectTelegramRequest, toConnectTelegramType } from "./connect-telegram.mapper"

@Resolver()
/** GraphQL door of connectTelegram. */
export class ConnectTelegramResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Connects a Telegram bot from its token. */
    @Mutation(() => TelegramConnectedType, { name: "connectTelegram" })
    async connectTelegram(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ConnectTelegramInput,
    ): Promise<TelegramConnectedType> {
        const result = await this.commandBus.execute(
            new ConnectTelegramCommand({ request: toConnectTelegramRequest(workspaceId, input), principal }),
        )
        return toConnectTelegramType(result)
    }
}
