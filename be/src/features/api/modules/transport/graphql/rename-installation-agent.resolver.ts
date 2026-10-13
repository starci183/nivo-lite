import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RenameInstallationAgentCommand } from "../../application/rename-installation-agent.command"
import { ModuleInstallationType } from "./dto/module-installation.type"
import { RenameInstallationAgentInput } from "./dto/rename-installation-agent.input"
import { toModuleInstallationType, toRenameInstallationAgentRequest } from "./modules.mapper"

@Resolver()
/** GraphQL door that renames the agent of an installation. */
export class RenameInstallationAgentResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Renames the agent of an installation (the name the team sees in Office and on cards) and queues its OpenClaw sync. */
    @Mutation(() => ModuleInstallationType, { name: "renameInstallationAgent" })
    async renameInstallationAgent(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RenameInstallationAgentInput,
    ): Promise<ModuleInstallationType> {
        const result = await this.commandBus.execute(
            new RenameInstallationAgentCommand({
                request: toRenameInstallationAgentRequest(workspaceId, input),
                principal,
            }),
        )
        return toModuleInstallationType(result)
    }
}
