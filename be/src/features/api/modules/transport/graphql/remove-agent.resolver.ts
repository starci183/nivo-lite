import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RemoveAgentCommand } from "../../application/remove-agent.command"
import { ModuleInstallationIdInput } from "./dto/module-installation-id.input"
import { ModuleInstallationType } from "./dto/module-installation.type"
import { toModuleInstallationType, toRemoveAgentRequest } from "./modules.mapper"

@Resolver()
/** GraphQL door that removes an installed agent. */
export class RemoveAgentResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Removes the agent for good (the uninstall): owner or manager only; history stays, nothing runs, it leaves every list. */
    @Mutation(() => ModuleInstallationType, { name: "removeAgent" })
    async removeAgent(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ModuleInstallationIdInput,
    ): Promise<ModuleInstallationType> {
        const result = await this.commandBus.execute(
            new RemoveAgentCommand({ request: toRemoveAgentRequest(workspaceId, input), principal }),
        )
        return toModuleInstallationType(result)
    }
}
