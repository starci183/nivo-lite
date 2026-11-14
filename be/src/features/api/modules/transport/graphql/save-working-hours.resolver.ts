import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { SaveInstallationSettingCommand } from "../../application/save-installation-setting.command"
import { ModuleInstallationType } from "./dto/module-installation.type"
import { SaveWorkingHoursInput } from "./dto/save-working-hours.input"
import { toModuleInstallationType, toSaveWorkingHoursRequest } from "./modules.mapper"

@Resolver()
/** GraphQL door that saves the weekly working hours of an agent. */
export class SaveWorkingHoursResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Saves the working hours of an agent (with "answer after hours"); an empty text removes them. Read back as `settings.workingHours`. */
    @Mutation(() => ModuleInstallationType, { name: "saveWorkingHours" })
    async saveWorkingHours(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveWorkingHoursInput,
    ): Promise<ModuleInstallationType> {
        const result = await this.commandBus.execute(
            new SaveInstallationSettingCommand({ request: toSaveWorkingHoursRequest(workspaceId, input), principal }),
        )
        return toModuleInstallationType(result)
    }
}
