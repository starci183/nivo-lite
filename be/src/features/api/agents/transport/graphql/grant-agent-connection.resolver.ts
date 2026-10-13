import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GrantAgentConnectionCommand } from "../../application/grant-agent-connection.command"
import { AgentAckType } from "./dto/agent-ack.type"
import { GrantAgentConnectionInput } from "./dto/grant-agent-connection.input"
import { toAgentAckType, toGrantAgentConnectionRequest } from "./agents.mapper"

@Resolver()
/** GraphQL door that grants a connection to an agent. */
export class GrantAgentConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Grants a connection to the agent, or changes the grant; a manager only. */
    @Mutation(() => AgentAckType, { name: "grantAgentConnection" })
    async grantAgentConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GrantAgentConnectionInput,
    ): Promise<AgentAckType> {
        await this.commandBus.execute(
            new GrantAgentConnectionCommand({ request: toGrantAgentConnectionRequest(workspaceId, input), principal }),
        )
        return toAgentAckType()
    }
}
