import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { SetAgentNodeModeCommand } from "../../application/set-agent-node-mode.command"
import { AgentWorkflowVersionType } from "./dto/agent-workflow-version.type"
import { SetAgentNodeModeInput } from "./dto/set-agent-node-mode.input"

@Resolver()
/** GraphQL door of setAgentNodeMode: the owner sets one node of a workflow to `auto` or `ask`. */
export class SetAgentNodeModeResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** The setAgentNodeMode mutation: the new version of the workflow (or the running one when the node already had that mode). */
    @Mutation(() => AgentWorkflowVersionType, { name: "setAgentNodeMode" })
    setAgentNodeMode(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetAgentNodeModeInput,
    ): Promise<AgentWorkflowVersionType> {
        return this.commandBus.execute(new SetAgentNodeModeCommand({ request: { workspaceId, ...input }, principal }))
    }
}
