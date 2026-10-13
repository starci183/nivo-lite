import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetModuleLiveCommand } from "../../application/set-module-live.command"
import { ModuleInstallationType } from "./dto/module-installation.type"
import { SetModuleLiveInput } from "./dto/set-module-live.input"
import { toModuleInstallationType, toSetModuleLiveRequest } from "./modules.mapper"

@Resolver()
/** GraphQL door that switches an agent live or paused. */
export class SetModuleLiveResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Live means the agent acts on channels, paused means it stays silent; going live needs an applied context version. */
    @Mutation(() => ModuleInstallationType, { name: "setModuleLive" })
    async setModuleLive(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetModuleLiveInput,
    ): Promise<ModuleInstallationType> {
        const result = await this.commandBus.execute(
            new SetModuleLiveCommand({ request: toSetModuleLiveRequest(workspaceId, input), principal }),
        )
        return toModuleInstallationType(result)
    }
}
