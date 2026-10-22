import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AssignAgentWorkCommand } from "../../application/assign-agent-work.command"
import { AgentAssignmentType } from "./dto/agent-assignment.type"
import { AssignAgentWorkInput } from "./dto/assign-agent-work.input"
import { toAgentAssignmentType, toAssignAgentWorkRequest } from "./agents.mapper"

@Resolver()
/** GraphQL door that hands an agent work. */
export class AssignAgentWorkResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Hands an agent work; the server checks the agent is open to the caller by role or room. */
    @Mutation(() => AgentAssignmentType, { name: "assignAgentWork" })
    async assignAgentWork(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AssignAgentWorkInput,
    ): Promise<AgentAssignmentType> {
        const thread = await this.commandBus.execute(
            new AssignAgentWorkCommand({ request: toAssignAgentWorkRequest(workspaceId, input), principal }),
        )
        return toAgentAssignmentType(thread)
    }
}
