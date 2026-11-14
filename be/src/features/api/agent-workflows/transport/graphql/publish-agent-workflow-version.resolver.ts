import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { PublishAgentWorkflowVersionCommand } from "../../application/publish-agent-workflow-version.command"
import { AgentWorkflowVersionType } from "./dto/agent-workflow-version.type"
import { PublishAgentWorkflowVersionInput } from "./dto/publish-agent-workflow-version.input"

@Resolver()
/** GraphQL door of publishAgentWorkflowVersion. */
export class PublishAgentWorkflowVersionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** The publishAgentWorkflowVersion mutation. */
    @Mutation(() => AgentWorkflowVersionType, { name: "publishAgentWorkflowVersion" })
    publishAgentWorkflowVersion(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: PublishAgentWorkflowVersionInput,
    ): Promise<AgentWorkflowVersionType> {
        return this.commandBus.execute(
            new PublishAgentWorkflowVersionCommand({ request: { workspaceId, ...input }, principal }),
        )
    }
}
