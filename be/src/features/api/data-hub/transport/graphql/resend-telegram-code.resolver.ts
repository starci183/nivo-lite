import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ResendTelegramCodeCommand } from "../../application/resend-telegram-code.command"
import { ResendTelegramCodeInput } from "./dto/resend-telegram-code.input"
import { toResendTelegramCodeRequest } from "./resend-telegram-code.mapper"

@Resolver()
/** GraphQL door of resendTelegramCode. */
export class ResendTelegramCodeResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Asks Telegram for a fresh login code. */
    @Mutation(() => Boolean, { name: "resendTelegramCode" })
    async resendTelegramCode(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ResendTelegramCodeInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new ResendTelegramCodeCommand({ request: toResendTelegramCodeRequest(workspaceId, input), principal }),
        )
        return true
    }
}
