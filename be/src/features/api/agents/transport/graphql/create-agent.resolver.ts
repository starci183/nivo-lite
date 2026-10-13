import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateAgentCommand } from "../../application/create-agent.command"
import { AgentSummaryType } from "./dto/agent-summary.type"
import { CreateAgentInput } from "./dto/create-agent.input"
import { toAgentType, toCreateAgentRequest } from "./agents.mapper"

@Resolver()
/** GraphQL door that adds an agent. */
export class CreateAgentResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Adds an agent; a manager only, and the handle must be free. */
    @Mutation(() => AgentSummaryType, { name: "createAgent" })
    async createAgent(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CreateAgentInput,
    ): Promise<AgentSummaryType> {
        const result = await this.commandBus.execute(
            new CreateAgentCommand({ request: toCreateAgentRequest(workspaceId, input), principal }),
        )
        return toAgentType(result)
    }
}
