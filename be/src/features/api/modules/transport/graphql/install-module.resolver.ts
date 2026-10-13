import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { InstallModuleCommand } from "../../application/install-module.command"
import { ModuleInstallResultType } from "./dto/module-install-result.type"
import { InstallModuleInput } from "./dto/install-module.input"
import { toInstallModuleRequest, toModuleInstallResultType } from "./modules.mapper"

@Resolver()
/** GraphQL door that installs a module. */
export class InstallModuleResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Installs a module (its agent, its default rules, its OpenClaw copy), or adds an instance of a multi-instance type; idempotent without `newInstance`. */
    @Mutation(() => ModuleInstallResultType, { name: "installModule" })
    async installModule(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: InstallModuleInput,
    ): Promise<ModuleInstallResultType> {
        const result = await this.commandBus.execute(
            new InstallModuleCommand({ request: toInstallModuleRequest(workspaceId, input, locale), principal }),
        )
        return toModuleInstallResultType(result)
    }
}
