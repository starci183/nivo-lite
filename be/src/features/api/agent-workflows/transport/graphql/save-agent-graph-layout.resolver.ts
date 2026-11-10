import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveAgentGraphLayoutCommand } from "../../application/save-agent-graph-layout.command"
import { AgentGraphLayoutType } from "./dto/agent-graph-layout.type"
import { SaveAgentGraphLayoutInput } from "./dto/save-agent-graph-layout.input"

@Resolver()
/** GraphQL door of saveAgentGraphLayout. */
export class SaveAgentGraphLayoutResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** The saveAgentGraphLayout mutation. */
    @Mutation(() => AgentGraphLayoutType, { name: "saveAgentGraphLayout" })
    saveAgentGraphLayout(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveAgentGraphLayoutInput,
    ): Promise<AgentGraphLayoutType> {
        return this.commandBus.execute(new SaveAgentGraphLayoutCommand({ request: { workspaceId, ...input }, principal }))
    }
}
