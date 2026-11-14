import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { AgentWorkflowQuery } from "../../application/agent-workflow.query"
import { AgentWorkflowDetailType } from "./dto/agent-workflow-detail.type"
import { AgentWorkflowInput } from "./dto/agent-workflow.input"

@Resolver()
/** GraphQL door of agentWorkflow. */
export class AgentWorkflowResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The agentWorkflow query. */
    @Query(() => AgentWorkflowDetailType, { name: "agentWorkflow" })
    agentWorkflow(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentWorkflowInput,
    ): Promise<AgentWorkflowDetailType> {
        return this.queryBus.execute(new AgentWorkflowQuery({ request: { workspaceId, ...input }, principal }))
    }
}
