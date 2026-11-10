import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptAgentWorkflowTemplateCommand } from "../../application/accept-agent-workflow-template.command"
import { AgentWorkflowVersionType } from "./dto/agent-workflow-version.type"
import { AcceptAgentWorkflowTemplateInput } from "./dto/accept-agent-workflow-template.input"

@Resolver()
/** GraphQL door of acceptAgentWorkflowTemplate. */
export class AcceptAgentWorkflowTemplateResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** The acceptAgentWorkflowTemplate mutation. */
    @Mutation(() => AgentWorkflowVersionType, { name: "acceptAgentWorkflowTemplate" })
    acceptAgentWorkflowTemplate(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AcceptAgentWorkflowTemplateInput,
    ): Promise<AgentWorkflowVersionType> {
        return this.commandBus.execute(
            new AcceptAgentWorkflowTemplateCommand({ request: { workspaceId, ...input }, principal }),
        )
    }
}
