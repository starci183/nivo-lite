import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { BindableAgentsQuery } from "../../application/bindable-agents.query"
import { toBindableAgentsRequest, toBindableAgentsType } from "./bindable-agents.mapper"
import { BindableAgentType } from "./dto/bindable-agent.type"
import { BindableAgentsInput } from "./dto/bindable-agents.input"

@Resolver()
/** GraphQL door of bindableAgents. */
export class BindableAgentsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks which active agents may be bound to a connection of a provider; any member may look. */
    @Query(() => [BindableAgentType], { name: "bindableAgents" })
    async bindableAgents(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: BindableAgentsInput,
    ): Promise<Array<BindableAgentType>> {
        const result = await this.queryBus.execute(
            new BindableAgentsQuery({ request: toBindableAgentsRequest(workspaceId, input), principal }),
        )
        return toBindableAgentsType(result)
    }
}
