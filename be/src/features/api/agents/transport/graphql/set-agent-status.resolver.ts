import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetAgentStatusCommand } from "../../application/set-agent-status.command"
import { AgentAckType } from "./dto/agent-ack.type"
import { SetAgentStatusInput } from "./dto/set-agent-status.input"
import { toAgentAckType, toSetAgentStatusRequest } from "./agents.mapper"

@Resolver()
/** GraphQL door that pauses or resumes an agent. */
export class SetAgentStatusResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Pauses or resumes an agent; a manager only. */
    @Mutation(() => AgentAckType, { name: "setAgentStatus" })
    async setAgentStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetAgentStatusInput,
    ): Promise<AgentAckType> {
        await this.commandBus.execute(
            new SetAgentStatusCommand({ request: toSetAgentStatusRequest(workspaceId, input), principal }),
        )
        return toAgentAckType()
    }
}
