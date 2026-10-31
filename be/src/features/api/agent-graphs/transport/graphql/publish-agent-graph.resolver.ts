import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { PublishAgentGraphCommand } from "../../application/publish-agent-graph.command"
import { AgentGraphVersionType } from "./dto/agent-graph-version.type"
import { PublishAgentGraphInput } from "./dto/publish-agent-graph.input"

@Resolver()
/** GraphQL door of publishAgentGraph. */
export class PublishAgentGraphResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** The publishAgentGraph mutation. */
    @Mutation(() => AgentGraphVersionType, { name: "publishAgentGraph" })
    publishAgentGraph(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: PublishAgentGraphInput,
    ): Promise<AgentGraphVersionType> {
        return this.commandBus.execute(
            new PublishAgentGraphCommand({
                request: { workspaceId, agentId: input.agentId, note: input.note },
                principal,
            }),
        )
    }
}
