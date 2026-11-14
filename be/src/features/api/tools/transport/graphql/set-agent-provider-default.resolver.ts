import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { SetAgentProviderDefaultCommand } from "../../application/set-agent-provider-default.command"
import { SetAgentProviderDefaultInput } from "./dto/set-agent-provider-default.input"
import { toCommandDone } from "./tools.mapper"

@Resolver()
/** GraphQL door of setAgentProviderDefault. */
export class SetAgentProviderDefaultResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /**
     * Makes the agent's attachment to a connected account its DEFAULT account of that provider: the account a step's call uses when the
     * agent holds several accounts of the provider and neither the run's trigger nor the run's earlier calls name one. The default it
     * replaces loses the flag. Owner or manager; refused when the agent is not attached to the account.
     */
    @Mutation(() => Boolean, { name: "setAgentProviderDefault" })
    async setAgentProviderDefault(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetAgentProviderDefaultInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new SetAgentProviderDefaultCommand({
                request: { workspaceId, agentId: input.agentId, connectionId: input.connectionId },
                principal,
            }),
        )
        return toCommandDone()
    }
}
