import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RenameInstallationCommand } from "../../application/rename-installation.command"
import { ModuleInstallationType } from "./dto/module-installation.type"
import { RenameModuleInstallationInput } from "./dto/rename-module-installation.input"
import { toModuleInstallationType, toRenameInstallationRequest } from "./modules.mapper"

@Resolver()
/** GraphQL door that renames an instance. */
export class RenameModuleInstallationResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Renames an instance: its label in lists, the chrome and Office; unique per type in the workspace, case-insensitive. */
    @Mutation(() => ModuleInstallationType, { name: "renameModuleInstallation" })
    async renameModuleInstallation(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RenameModuleInstallationInput,
    ): Promise<ModuleInstallationType> {
        const result = await this.commandBus.execute(
            new RenameInstallationCommand({ request: toRenameInstallationRequest(workspaceId, input), principal }),
        )
        return toModuleInstallationType(result)
    }
}
