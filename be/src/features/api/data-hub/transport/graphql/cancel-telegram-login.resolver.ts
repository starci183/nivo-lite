import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CancelTelegramLoginCommand } from "../../application/cancel-telegram-login.command"
import { CancelTelegramLoginInput } from "./dto/cancel-telegram-login.input"
import { toCancelTelegramLoginRequest } from "./cancel-telegram-login.mapper"

@Resolver()
/** GraphQL door of cancelTelegramLogin. */
export class CancelTelegramLoginResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Cancels a Telegram login in progress. */
    @Mutation(() => Boolean, { name: "cancelTelegramLogin" })
    async cancelTelegramLogin(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CancelTelegramLoginInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new CancelTelegramLoginCommand({ request: toCancelTelegramLoginRequest(workspaceId, input), principal }),
        )
        return true
    }
}
