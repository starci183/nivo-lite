import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DetachAgentProviderCommand } from "../../application/detach-agent-provider.command"
import { DetachAgentProviderInput } from "./dto/detach-agent-provider.input"
import { toMcpDone } from "./mcp-gateway.mapper"

@Resolver()
/** GraphQL door of detachAgentProvider. */
export class DetachAgentProviderResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Detaches an agent from a provider; every ability it held there goes. */
    @Mutation(() => Boolean, { name: "detachAgentProvider" })
    async detachAgentProvider(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DetachAgentProviderInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new DetachAgentProviderCommand({
                request: { workspaceId, agentId: input.agentId, provider: input.provider },
                principal,
            }),
        )
        return toMcpDone()
    }
}
