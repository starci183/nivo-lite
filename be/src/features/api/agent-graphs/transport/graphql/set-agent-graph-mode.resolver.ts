import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetAgentGraphModeCommand } from "../../application/set-agent-graph-mode.command"
import { SetAgentGraphModeInput } from "./dto/set-agent-graph-mode.input"

@Resolver()
/** GraphQL door of setAgentGraphMode. */
export class SetAgentGraphModeResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** The setAgentGraphMode mutation. */
    @Mutation(() => Boolean, { name: "setAgentGraphMode" })
    async setAgentGraphMode(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetAgentGraphModeInput,
    ): Promise<boolean> {
        await this.commandBus.execute(new SetAgentGraphModeCommand({ request: { workspaceId, agentId: input.agentId, mode: input.mode }, principal }))
        return true
    }
}
