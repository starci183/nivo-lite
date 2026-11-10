import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AgentWorkflowsQuery } from "../../application/agent-workflows.query"
import { AgentWorkflowType } from "./dto/agent-workflow.type"
import { AgentWorkflowsInput } from "./dto/agent-workflows.input"

@Resolver()
/** GraphQL door of agentWorkflows. */
export class AgentWorkflowsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The agentWorkflows query. */
    @Query(() => [AgentWorkflowType], { name: "agentWorkflows" })
    agentWorkflows(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentWorkflowsInput,
    ): Promise<ReadonlyArray<AgentWorkflowType>> {
        return this.queryBus.execute(new AgentWorkflowsQuery({ request: { workspaceId, ...input }, principal }))
    }
}
