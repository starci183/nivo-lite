import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SubmitTelegramCodeCommand } from "../../application/submit-telegram-code.command"
import { SubmitTelegramCodeInput } from "./dto/submit-telegram-code.input"
import { TelegramLoginStageType } from "./dto/telegram-login-stage.type"
import { toSubmitTelegramCodeRequest, toSubmitTelegramCodeType } from "./submit-telegram-code.mapper"

@Resolver()
/** GraphQL door of submitTelegramCode. */
export class SubmitTelegramCodeResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Submits the Telegram login code. */
    @Mutation(() => TelegramLoginStageType, { name: "submitTelegramCode" })
    async submitTelegramCode(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SubmitTelegramCodeInput,
    ): Promise<TelegramLoginStageType> {
        const result = await this.commandBus.execute(
            new SubmitTelegramCodeCommand({ request: toSubmitTelegramCodeRequest(workspaceId, input), principal }),
        )
        return toSubmitTelegramCodeType(result)
    }
}
