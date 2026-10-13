import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveTelegramUserSetupCommand } from "../../application/save-telegram-user-setup.command"
import { SaveTelegramUserSetupInput } from "./dto/save-telegram-user-setup.input"
import { toSaveTelegramUserSetupRequest } from "./save-telegram-user-setup.mapper"

@Resolver()
/** GraphQL door of saveTelegramUserSetup. */
export class SaveTelegramUserSetupResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Saves the chosen Telegram chats and schedule. */
    @Mutation(() => Boolean, { name: "saveTelegramUserSetup" })
    async saveTelegramUserSetup(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveTelegramUserSetupInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new SaveTelegramUserSetupCommand({
                request: toSaveTelegramUserSetupRequest(workspaceId, input),
                principal,
            }),
        )
        return true
    }
}
