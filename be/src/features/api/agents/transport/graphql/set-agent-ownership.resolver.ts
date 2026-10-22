import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetAgentOwnershipCommand } from "../../application/set-agent-ownership.command"
import { AgentAckType } from "./dto/agent-ack.type"
import { SetAgentOwnershipInput } from "./dto/set-agent-ownership.input"
import { toAgentAckType, toSetAgentOwnershipRequest } from "./agents.mapper"

@Resolver()
/** GraphQL door that replaces who is in charge of an agent. */
export class SetAgentOwnershipResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Replaces the owner, the fallback, who may give the agent work and whom it may tag; a manager only. */
    @Mutation(() => AgentAckType, { name: "setAgentOwnership" })
    async setAgentOwnership(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetAgentOwnershipInput,
    ): Promise<AgentAckType> {
        await this.commandBus.execute(
            new SetAgentOwnershipCommand({ request: toSetAgentOwnershipRequest(workspaceId, input), principal }),
        )
        return toAgentAckType()
    }
}
