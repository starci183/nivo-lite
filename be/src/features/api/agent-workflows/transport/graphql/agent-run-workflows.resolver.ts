import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { AgentRunWorkflowsQuery } from "../../application/agent-run-workflows.query"
import { AgentRunWorkflowPinType } from "./dto/agent-run-workflow-pin.type"
import { AgentRunWorkflowsInput } from "./dto/agent-run-workflows.input"

@Resolver()
/** GraphQL door of agentRunWorkflows. */
export class AgentRunWorkflowsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The agentRunWorkflows query. */
    @Query(() => [AgentRunWorkflowPinType], { name: "agentRunWorkflows" })
    agentRunWorkflows(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentRunWorkflowsInput,
    ): Promise<ReadonlyArray<AgentRunWorkflowPinType>> {
        return this.queryBus.execute(new AgentRunWorkflowsQuery({ request: { workspaceId, ...input }, principal }))
    }
}
