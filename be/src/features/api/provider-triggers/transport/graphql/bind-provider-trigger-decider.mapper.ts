import type { ProviderTriggerState } from "@modules/domain/provider-triggers"
import type { BindProviderTriggerDeciderRequest } from "../../application/bind-provider-trigger-decider.contracts"
import type { BindProviderTriggerDeciderInput } from "./dto/bind-provider-trigger-decider.input"
import type { ProviderTriggerStateType } from "./dto/get-provider-trigger-states.type"

/** Maps the GraphQL arguments of bindProviderTriggerDecider to the request; an absent agent travels as absent (unbind). */
export const toBindProviderTriggerDeciderRequest = (
    workspaceId: string,
    input: BindProviderTriggerDeciderInput,
): BindProviderTriggerDeciderRequest => ({
    workspaceId,
    change: { connectionId: input.connectionId, trigger: input.trigger, agentId: input.agentId },
})

/** Maps the trigger's state after the binding to the GraphQL type: the capability already answers in its shape. */
export const toBindProviderTriggerDeciderType = (state: ProviderTriggerState): ProviderTriggerStateType => state
