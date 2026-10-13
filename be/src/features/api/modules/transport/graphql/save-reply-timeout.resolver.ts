import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveInstallationSettingCommand } from "../../application/save-installation-setting.command"
import { ModuleInstallationType } from "./dto/module-installation.type"
import { SaveReplyTimeoutInput } from "./dto/save-reply-timeout.input"
import { toModuleInstallationType, toSaveReplyTimeoutRequest } from "./modules.mapper"

@Resolver()
/** GraphQL door that saves the reply timeout of an agent. */
export class SaveReplyTimeoutResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Saves the longest a customer waits before the app answers directly, in seconds. */
    @Mutation(() => ModuleInstallationType, { name: "saveReplyTimeout" })
    async saveReplyTimeout(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveReplyTimeoutInput,
    ): Promise<ModuleInstallationType> {
        const result = await this.commandBus.execute(
            new SaveInstallationSettingCommand({ request: toSaveReplyTimeoutRequest(workspaceId, input), principal }),
        )
        return toModuleInstallationType(result)
    }
}
