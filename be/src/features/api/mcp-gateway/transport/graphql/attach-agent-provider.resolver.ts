import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AttachAgentProviderCommand } from "../../application/attach-agent-provider.command"
import { AttachAgentProviderInput } from "./dto/attach-agent-provider.input"
import { toMcpDone } from "./mcp-gateway.mapper"
import { toAbilityWishes } from "./provider-rights.mapper"

@Resolver()
/** GraphQL door of attachAgentProvider. */
export class AttachAgentProviderResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Attaches an agent to a connected provider with the abilities ticked. */
    @Mutation(() => Boolean, { name: "attachAgentProvider" })
    async attachAgentProvider(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AttachAgentProviderInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new AttachAgentProviderCommand({
                request: {
                    workspaceId,
                    agentId: input.agentId,
                    wish: { connectionId: input.connectionId, abilities: toAbilityWishes(input.abilities) },
                },
                principal,
            }),
        )
        return toMcpDone()
    }
}
