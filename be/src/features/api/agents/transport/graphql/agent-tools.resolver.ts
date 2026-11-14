import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { GetAgentToolsQuery } from "../../application/get-agent-tools.query"
import { AgentIdInput } from "./dto/agent-id.input"
import { AgentToolType } from "./dto/agent-tool.type"
import { toAgentToolsType, toGetAgentToolsRequest } from "./agent-tools.mapper"

@Resolver()
/** GraphQL door of the tool set of one agent. */
export class AgentToolsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The tools the agent can really call, in the shop's words, with the accounts and grant rows that bound them (owner or manager). */
    @Query(() => [AgentToolType], { name: "agentTools" })
    async agentTools(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentIdInput,
    ): Promise<Array<AgentToolType>> {
        const result = await this.queryBus.execute(
            new GetAgentToolsQuery({ request: toGetAgentToolsRequest(workspaceId, input), principal }),
        )
        return toAgentToolsType(result)
    }
}
