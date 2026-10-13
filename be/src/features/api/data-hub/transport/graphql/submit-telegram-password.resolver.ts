import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SubmitTelegramPasswordCommand } from "../../application/submit-telegram-password.command"
import { SubmitTelegramPasswordInput } from "./dto/submit-telegram-password.input"
import { TelegramLoginStageType } from "./dto/telegram-login-stage.type"
import { toSubmitTelegramPasswordRequest, toSubmitTelegramPasswordType } from "./submit-telegram-password.mapper"

@Resolver()
/** GraphQL door of submitTelegramPassword. */
export class SubmitTelegramPasswordResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Submits the Telegram two-step password. */
    @Mutation(() => TelegramLoginStageType, { name: "submitTelegramPassword" })
    async submitTelegramPassword(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SubmitTelegramPasswordInput,
    ): Promise<TelegramLoginStageType> {
        const result = await this.commandBus.execute(
            new SubmitTelegramPasswordCommand({
                request: toSubmitTelegramPasswordRequest(workspaceId, input),
                principal,
            }),
        )
        return toSubmitTelegramPasswordType(result)
    }
}
