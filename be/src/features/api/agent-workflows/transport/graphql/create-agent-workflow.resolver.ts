import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateAgentWorkflowCommand } from "../../application/create-agent-workflow.command"
import { AgentWorkflowType } from "./dto/agent-workflow.type"
import { CreateAgentWorkflowInput } from "./dto/create-agent-workflow.input"

@Resolver()
/** GraphQL door of createAgentWorkflow. */
export class CreateAgentWorkflowResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** The createAgentWorkflow mutation. */
    @Mutation(() => AgentWorkflowType, { name: "createAgentWorkflow" })
    createAgentWorkflow(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CreateAgentWorkflowInput,
    ): Promise<AgentWorkflowType> {
        return this.commandBus.execute(
            new CreateAgentWorkflowCommand({ request: { workspaceId, ...input }, principal }),
        )
    }
}
