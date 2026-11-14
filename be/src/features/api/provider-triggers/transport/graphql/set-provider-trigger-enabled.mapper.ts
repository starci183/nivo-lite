import type { ProviderTriggerState } from "@modules/domain/provider-triggers"
import type { SetProviderTriggerEnabledRequest } from "../../application/set-provider-trigger-enabled.contracts"
import type { ProviderTriggerStateType } from "./dto/get-provider-trigger-states.type"
import type { SetProviderTriggerEnabledInput } from "./dto/set-provider-trigger-enabled.input"

/** Maps the GraphQL arguments of setProviderTriggerEnabled to the request. */
export const toSetProviderTriggerEnabledRequest = (
    workspaceId: string,
    input: SetProviderTriggerEnabledInput,
): SetProviderTriggerEnabledRequest => ({
    workspaceId,
    change: { connectionId: input.connectionId, trigger: input.trigger, enabled: input.enabled, catchUp: input.catchUp },
})

/** Maps the trigger's state after the change to the GraphQL type: the capability already answers in its shape. */
export const toSetProviderTriggerEnabledType = (state: ProviderTriggerState): ProviderTriggerStateType => state
