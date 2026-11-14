import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { RollbackAgentWorkflowCommand } from "../../application/rollback-agent-workflow.command"
import { AgentWorkflowVersionType } from "./dto/agent-workflow-version.type"
import { RollbackAgentWorkflowInput } from "./dto/rollback-agent-workflow.input"

@Resolver()
/** GraphQL door of rollbackAgentWorkflow. */
export class RollbackAgentWorkflowResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** The rollbackAgentWorkflow mutation. */
    @Mutation(() => AgentWorkflowVersionType, { name: "rollbackAgentWorkflow" })
    rollbackAgentWorkflow(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RollbackAgentWorkflowInput,
    ): Promise<AgentWorkflowVersionType> {
        return this.commandBus.execute(
            new RollbackAgentWorkflowCommand({ request: { workspaceId, ...input }, principal }),
        )
    }
}
