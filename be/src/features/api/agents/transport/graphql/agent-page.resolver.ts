import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetAgentPageQuery } from "../../application/get-agent-page.query"
import { AgentPageType } from "./dto/agent-page.type"
import { AgentIdInput } from "./dto/agent-id.input"
import { toAgentPageRequest, toAgentPageType } from "./agents.mapper"

@Resolver()
/** GraphQL door of the profile page of one agent. */
export class AgentPageResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads who is in charge of an agent, who may give it work, whom it may tag, its rules and its latest work. */
    @Query(() => AgentPageType, { name: "agentPage" })
    async agentPage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentIdInput,
    ): Promise<AgentPageType> {
        const result = await this.queryBus.execute(
            new GetAgentPageQuery({ request: toAgentPageRequest(workspaceId, input), principal }),
        )
        return toAgentPageType(result)
    }
}
