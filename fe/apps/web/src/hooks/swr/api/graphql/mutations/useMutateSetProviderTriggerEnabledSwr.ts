"use client"

import { mutateSetProviderTriggerEnabled, type MutateSetProviderTriggerEnabledRequest } from "@/modules/api/graphql/mutations/mutation-set-provider-trigger-enabled"
import { answeredData } from "@/hooks/workspaceread"
import type { SetProviderTriggerEnabledMutation } from "@/modules/api"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"

/** The SWR key of the setProviderTriggerEnabled mutation. */
export const MUTATE_SET_PROVIDER_TRIGGER_ENABLED_SWR_KEY = "MUTATE_SET_PROVIDER_TRIGGER_ENABLED_SWR"

/** The row of the trigger after the change. */
type Row = SetProviderTriggerEnabledMutation["setProviderTriggerEnabled"]

/** SWR mutation for {@link mutateSetProviderTriggerEnabled}: `trigger(input)` answers the trigger's row and rejects with the back end failure. */
export const useMutateSetProviderTriggerEnabledSwr = (): SWRMutationResponse<Row, Error, typeof MUTATE_SET_PROVIDER_TRIGGER_ENABLED_SWR_KEY, MutateSetProviderTriggerEnabledRequest> =>
    useSWRMutation(
        MUTATE_SET_PROVIDER_TRIGGER_ENABLED_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSetProviderTriggerEnabled({ request: arg }), MUTATE_SET_PROVIDER_TRIGGER_ENABLED_SWR_KEY).setProviderTriggerEnabled,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateSetProviderTriggerEnabledRequest
}
