import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AgentWorkflowTemplatePreviewQuery } from "../../application/agent-workflow-template-preview.query"
import { AgentWorkflowTemplatePreviewType } from "./dto/agent-workflow-template-preview.type"
import { AgentWorkflowTemplatePreviewInput } from "./dto/agent-workflow-template-preview.input"

@Resolver()
/** GraphQL door of agentWorkflowTemplatePreview. */
export class AgentWorkflowTemplatePreviewResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The agentWorkflowTemplatePreview query. */
    @Query(() => AgentWorkflowTemplatePreviewType, { name: "agentWorkflowTemplatePreview" })
    agentWorkflowTemplatePreview(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentWorkflowTemplatePreviewInput,
    ): Promise<AgentWorkflowTemplatePreviewType> {
        return this.queryBus.execute(
            new AgentWorkflowTemplatePreviewQuery({ request: { workspaceId, ...input }, principal }),
        )
    }
}
