import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { SetProviderTriggerEnabledCommand } from "../../application/set-provider-trigger-enabled.command"
import { ProviderTriggerStateType } from "./dto/get-provider-trigger-states.type"
import { SetProviderTriggerEnabledInput } from "./dto/set-provider-trigger-enabled.input"
import { toSetProviderTriggerEnabledRequest, toSetProviderTriggerEnabledType } from "./set-provider-trigger-enabled.mapper"

@Resolver()
/** GraphQL door of setProviderTriggerEnabled. */
export class SetProviderTriggerEnabledResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Turns the trigger of a connected account on or off (owner or manager); answers the trigger's state after the change. */
    @Mutation(() => ProviderTriggerStateType, { name: "setProviderTriggerEnabled" })
    async setProviderTriggerEnabled(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetProviderTriggerEnabledInput,
    ): Promise<ProviderTriggerStateType> {
        const state = await this.commandBus.execute(
            new SetProviderTriggerEnabledCommand({ request: toSetProviderTriggerEnabledRequest(workspaceId, input), principal }),
        )
        return toSetProviderTriggerEnabledType(state)
    }
}
