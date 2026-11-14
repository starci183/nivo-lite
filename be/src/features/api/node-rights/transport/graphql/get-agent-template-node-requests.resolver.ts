import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { GetAgentTemplateNodeRequestsQuery } from "../../application/get-agent-template-node-requests.query"
import { GetAgentTemplateNodeRequestsInput } from "./dto/get-agent-template-node-requests.input"
import { AgentTemplateNodeRequestsType } from "./dto/get-agent-template-node-requests.type"
import {
    toAgentTemplateNodeRequestsType,
    toGetAgentTemplateNodeRequestsRequest,
} from "./get-agent-template-node-requests.mapper"

@Resolver()
/** GraphQL door of agentTemplateNodeRequests. */
export class GetAgentTemplateNodeRequestsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** What a workflow template's nodes ask for on accounts, before anything is installed. Any member; read-only. */
    @Query(() => AgentTemplateNodeRequestsType, { name: "agentTemplateNodeRequests" })
    async agentTemplateNodeRequests(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetAgentTemplateNodeRequestsInput,
    ): Promise<AgentTemplateNodeRequestsType> {
        const answer = await this.queryBus.execute(
            new GetAgentTemplateNodeRequestsQuery({
                request: toGetAgentTemplateNodeRequestsRequest(workspaceId, input),
                principal,
            }),
        )
        return toAgentTemplateNodeRequestsType(answer)
    }
}
