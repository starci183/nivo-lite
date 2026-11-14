"use client"

import { mutateBindProviderTriggerDecider, type MutateBindProviderTriggerDeciderRequest } from "@/modules/api/graphql/mutations/mutation-bind-provider-trigger-decider"
import { answeredData } from "@/hooks/workspaceread"
import type { BindProviderTriggerDeciderMutation } from "@/modules/api"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"

/** The SWR key of the bindProviderTriggerDecider mutation. */
export const MUTATE_BIND_PROVIDER_TRIGGER_DECIDER_SWR_KEY = "MUTATE_BIND_PROVIDER_TRIGGER_DECIDER_SWR"

/** The row of the trigger after the change. */
type Row = BindProviderTriggerDeciderMutation["bindProviderTriggerDecider"]

/** SWR mutation for {@link mutateBindProviderTriggerDecider}: `trigger(input)` answers the trigger's row and rejects with the back end failure. */
export const useMutateBindProviderTriggerDeciderSwr = (): SWRMutationResponse<Row, Error, typeof MUTATE_BIND_PROVIDER_TRIGGER_DECIDER_SWR_KEY, MutateBindProviderTriggerDeciderRequest> =>
    useSWRMutation(
        MUTATE_BIND_PROVIDER_TRIGGER_DECIDER_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateBindProviderTriggerDecider({ request: arg }), MUTATE_BIND_PROVIDER_TRIGGER_DECIDER_SWR_KEY).bindProviderTriggerDecider,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateBindProviderTriggerDeciderRequest
}
