import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RestoreAgentGraphVersionCommand } from "../../application/restore-agent-graph-version.command"
import { AgentGraphVersionType } from "./dto/agent-graph-version.type"
import { RestoreAgentGraphVersionInput } from "./dto/restore-agent-graph-version.input"

@Resolver()
/** GraphQL door of restoreAgentGraphVersion. */
export class RestoreAgentGraphVersionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** The restoreAgentGraphVersion mutation. */
    @Mutation(() => AgentGraphVersionType, { name: "restoreAgentGraphVersion" })
    restoreAgentGraphVersion(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RestoreAgentGraphVersionInput,
    ): Promise<AgentGraphVersionType> {
        return this.commandBus.execute(new RestoreAgentGraphVersionCommand({ request: { workspaceId, agentId: input.agentId, versionId: input.versionId }, principal }))
    }
}
