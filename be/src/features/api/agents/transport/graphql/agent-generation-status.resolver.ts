import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetGenerationStatusQuery } from "../../application/get-generation-status.query"
import { AgentGenerationStatusType } from "./dto/agent-generation-status.type"
import { AgentGenerationIdInput } from "./dto/agent-generation-id.input"
import { toAgentGenerationStatusType, toGetGenerationStatusRequest } from "./agents.mapper"

@Resolver()
/** GraphQL door of the status of a queued text. */
export class AgentGenerationStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Where a queued text stands; any member may look. */
    @Query(() => AgentGenerationStatusType, { name: "agentGenerationStatus" })
    async agentGenerationStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentGenerationIdInput,
    ): Promise<AgentGenerationStatusType> {
        const result = await this.queryBus.execute(
            new GetGenerationStatusQuery({ request: toGetGenerationStatusRequest(workspaceId, input), principal }),
        )
        return toAgentGenerationStatusType(result)
    }
}
