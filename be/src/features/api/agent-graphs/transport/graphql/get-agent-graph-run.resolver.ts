import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetAgentGraphRunQuery } from "../../application/get-agent-graph-run.query"
import { AgentGraphRunType } from "./dto/agent-graph-run.type"
import { GetAgentGraphRunInput } from "./dto/get-agent-graph-run.input"

@Resolver()
/** GraphQL door of agentGraphRun. */
export class GetAgentGraphRunResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the trace of the run of one work item through the graph: the trigger, the branch, the nodes and the version. */
    @Query(() => AgentGraphRunType, { name: "agentGraphRun" })
    agentGraphRun(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetAgentGraphRunInput,
    ): Promise<AgentGraphRunType> {
        return this.queryBus.execute(new GetAgentGraphRunQuery({ request: { workspaceId, workItemId: input.workItemId }, principal }))
    }
}
