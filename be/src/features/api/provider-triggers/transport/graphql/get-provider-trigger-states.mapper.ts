import type { ProviderTriggerState } from "@modules/domain/provider-triggers"
import type { GetProviderTriggerStatesRequest } from "../../application/get-provider-trigger-states.contracts"
import type { GetProviderTriggerStatesInput } from "./dto/get-provider-trigger-states.input"
import type { ProviderTriggerStateType } from "./dto/get-provider-trigger-states.type"

/** Maps the GraphQL arguments of providerTriggerStates to the request. */
export const toGetProviderTriggerStatesRequest = (
    workspaceId: string,
    input: GetProviderTriggerStatesInput,
): GetProviderTriggerStatesRequest => ({ workspaceId, connectionId: input.connectionId })

/** Maps the answer of providerTriggerStates to the GraphQL type: the capability already answers in its shape. */
export const toProviderTriggerStateTypes = (
    states: ReadonlyArray<ProviderTriggerState>,
): ReadonlyArray<ProviderTriggerStateType> => states
