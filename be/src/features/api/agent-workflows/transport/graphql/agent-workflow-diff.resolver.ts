import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AgentWorkflowDiffQuery } from "../../application/agent-workflow-diff.query"
import { AgentWorkflowDiffType } from "./dto/agent-workflow-diff.type"
import { AgentWorkflowDiffInput } from "./dto/agent-workflow-diff.input"

@Resolver()
/** GraphQL door of agentWorkflowDiff. */
export class AgentWorkflowDiffResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The agentWorkflowDiff query. */
    @Query(() => AgentWorkflowDiffType, { name: "agentWorkflowDiff" })
    agentWorkflowDiff(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentWorkflowDiffInput,
    ): Promise<AgentWorkflowDiffType> {
        return this.queryBus.execute(new AgentWorkflowDiffQuery({ request: { workspaceId, ...input }, principal }))
    }
}
