import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { BindProviderTriggerDeciderCommand } from "../../application/bind-provider-trigger-decider.command"
import { toBindProviderTriggerDeciderRequest, toBindProviderTriggerDeciderType } from "./bind-provider-trigger-decider.mapper"
import { BindProviderTriggerDeciderInput } from "./dto/bind-provider-trigger-decider.input"
import { ProviderTriggerStateType } from "./dto/get-provider-trigger-states.type"

@Resolver()
/** GraphQL door of bindProviderTriggerDecider. */
export class BindProviderTriggerDeciderResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Binds the agent that decides on a connected account's trigger, or unbinds it with no agent (owner or manager). */
    @Mutation(() => ProviderTriggerStateType, { name: "bindProviderTriggerDecider" })
    async bindProviderTriggerDecider(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: BindProviderTriggerDeciderInput,
    ): Promise<ProviderTriggerStateType> {
        const state = await this.commandBus.execute(
            new BindProviderTriggerDeciderCommand({ request: toBindProviderTriggerDeciderRequest(workspaceId, input), principal }),
        )
        return toBindProviderTriggerDeciderType(state)
    }
}
