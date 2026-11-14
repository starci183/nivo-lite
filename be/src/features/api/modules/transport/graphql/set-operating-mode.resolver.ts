import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { SetOperatingModeCommand } from "../../application/set-operating-mode.command"
import { ModuleInstallationType } from "./dto/module-installation.type"
import { SetOperatingModeInput } from "./dto/set-operating-mode.input"
import { toModuleInstallationType, toSetOperatingModeRequest } from "./modules.mapper"

@Resolver()
/** GraphQL door that sets how an agent runs. */
export class SetOperatingModeResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Gone: a node's declared mode alone decides; the web still calls it, so it answers a typed refusal (MODULES_OPERATING_MODE_REMOVED). */
    @Mutation(() => ModuleInstallationType, { name: "setOperatingMode" })
    async setOperatingMode(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetOperatingModeInput,
    ): Promise<ModuleInstallationType> {
        const result = await this.commandBus.execute(
            new SetOperatingModeCommand({ request: toSetOperatingModeRequest(workspaceId, input), principal }),
        )
        return toModuleInstallationType(result)
    }
}
