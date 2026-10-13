import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RevokeAgentConnectionCommand } from "../../application/revoke-agent-connection.command"
import { AgentAckType } from "./dto/agent-ack.type"
import { RevokeAgentConnectionInput } from "./dto/revoke-agent-connection.input"
import { toAgentAckType, toRevokeAgentConnectionRequest } from "./agents.mapper"

@Resolver()
/** GraphQL door that removes the grant of a connection. */
export class RevokeAgentConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Removes the grant of a connection to the agent; a manager only. */
    @Mutation(() => AgentAckType, { name: "revokeAgentConnection" })
    async revokeAgentConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RevokeAgentConnectionInput,
    ): Promise<AgentAckType> {
        await this.commandBus.execute(
            new RevokeAgentConnectionCommand({
                request: toRevokeAgentConnectionRequest(workspaceId, input),
                principal,
            }),
        )
        return toAgentAckType()
    }
}
