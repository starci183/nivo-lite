import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveInstallationSettingCommand } from "../../application/save-installation-setting.command"
import { ModuleInstallationType } from "./dto/module-installation.type"
import { SaveHoldingMessageInput } from "./dto/save-holding-message.input"
import { toModuleInstallationType, toSaveHoldingMessageRequest } from "./modules.mapper"

@Resolver()
/** GraphQL door that saves the holding message of an agent. */
export class SaveHoldingMessageResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Saves the holding message of an agent; an empty text removes it. */
    @Mutation(() => ModuleInstallationType, { name: "saveHoldingMessage" })
    async saveHoldingMessage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveHoldingMessageInput,
    ): Promise<ModuleInstallationType> {
        const result = await this.commandBus.execute(
            new SaveInstallationSettingCommand({ request: toSaveHoldingMessageRequest(workspaceId, input), principal }),
        )
        return toModuleInstallationType(result)
    }
}
