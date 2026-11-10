import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AgentWorkflowGraphQuery } from "../../application/agent-workflow-graph.query"
import { AgentWorkflowGraphType } from "./dto/agent-workflow-graph.type"
import { AgentWorkflowGraphInput } from "./dto/agent-workflow-graph.input"

@Resolver()
/** GraphQL door of agentWorkflowGraph. */
export class AgentWorkflowGraphResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The agentWorkflowGraph query. */
    @Query(() => AgentWorkflowGraphType, { name: "agentWorkflowGraph" })
    agentWorkflowGraph(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentWorkflowGraphInput,
    ): Promise<AgentWorkflowGraphType> {
        return this.queryBus.execute(new AgentWorkflowGraphQuery({ request: { workspaceId, ...input }, principal }))
    }
}
