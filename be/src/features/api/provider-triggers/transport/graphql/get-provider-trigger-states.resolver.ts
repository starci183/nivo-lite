import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { GetProviderTriggerStatesQuery } from "../../application/get-provider-trigger-states.query"
import { GetProviderTriggerStatesInput } from "./dto/get-provider-trigger-states.input"
import { ProviderTriggerStateType } from "./dto/get-provider-trigger-states.type"
import { toGetProviderTriggerStatesRequest, toProviderTriggerStateTypes } from "./get-provider-trigger-states.mapper"

@Resolver()
/** GraphQL door of providerTriggerStates. */
export class GetProviderTriggerStatesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The states of a connected account's triggers (any member): stored switches and bindings only, no live provider call. */
    @Query(() => [ProviderTriggerStateType], { name: "providerTriggerStates" })
    async providerTriggerStates(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetProviderTriggerStatesInput,
    ): Promise<ReadonlyArray<ProviderTriggerStateType>> {
        const states = await this.queryBus.execute(
            new GetProviderTriggerStatesQuery({ request: toGetProviderTriggerStatesRequest(workspaceId, input), principal }),
        )
        return toProviderTriggerStateTypes(states)
    }
}
