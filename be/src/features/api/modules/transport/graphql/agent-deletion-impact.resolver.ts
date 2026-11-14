import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { AgentDeletionImpactQuery } from "../../application/agent-deletion-impact.query"
import { toAgentDeletionImpactRequest, toAgentDeletionImpactType } from "./agent-deletion-impact.mapper"
import { AgentDeletionImpactType } from "./dto/agent-deletion-impact.type"
import { ModuleInstallationIdInput } from "./dto/module-installation-id.input"

@Resolver()
/** GraphQL door of the warning shown before an agent is removed. */
export class AgentDeletionImpactResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** What removing the agent would take with it (its records per type, and their files): owner or manager only; changes nothing. */
    @Query(() => AgentDeletionImpactType, { name: "agentDeletionImpact" })
    async agentDeletionImpact(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ModuleInstallationIdInput,
    ): Promise<AgentDeletionImpactType> {
        const result = await this.queryBus.execute(
            new AgentDeletionImpactQuery({ request: toAgentDeletionImpactRequest(workspaceId, input), principal }),
        )
        return toAgentDeletionImpactType(result)
    }
}
