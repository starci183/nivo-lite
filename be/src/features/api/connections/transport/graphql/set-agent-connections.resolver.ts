import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetAgentConnectionsCommand } from "../../application/set-agent-connections.command"
import { SetAgentConnectionsInput } from "./dto/set-agent-connections.input"
import { toSetAgentConnectionsRequest } from "./set-agent-connections.mapper"

@Resolver()
/** GraphQL door of setAgentConnections. */
export class SetAgentConnectionsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Makes an agent use exactly these connections. */
    @Mutation(() => Boolean, { name: "setAgentConnections" })
    async setAgentConnections(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetAgentConnectionsInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new SetAgentConnectionsCommand({ request: toSetAgentConnectionsRequest(workspaceId, input), principal }),
        )
        return true
    }
}
