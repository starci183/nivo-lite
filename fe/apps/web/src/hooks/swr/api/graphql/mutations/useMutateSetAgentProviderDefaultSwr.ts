"use client"

import {
    mutateSetAgentProviderDefault,
    type MutateSetAgentProviderDefaultRequest,
} from "@/modules/api/graphql/mutations/mutation-set-agent-provider-default"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { SetAgentProviderDefaultMutation } from "@/modules/api"

/** The SWR key of the setAgentProviderDefault mutation. */
export const MUTATE_SET_AGENT_PROVIDER_DEFAULT_SWR_KEY = "MUTATE_SET_AGENT_PROVIDER_DEFAULT_SWR"

/** SWR mutation for {@link mutateSetAgentProviderDefault}: Makes an account the default of an agent for its provider. `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSetAgentProviderDefaultSwr = (): SWRMutationResponse<
    SetAgentProviderDefaultMutation["setAgentProviderDefault"],
    Error,
    typeof MUTATE_SET_AGENT_PROVIDER_DEFAULT_SWR_KEY,
    MutateSetAgentProviderDefaultRequest
> =>
    useSWRMutation(
        MUTATE_SET_AGENT_PROVIDER_DEFAULT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSetAgentProviderDefault({ request: arg }), MUTATE_SET_AGENT_PROVIDER_DEFAULT_SWR_KEY).setAgentProviderDefault,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateSetAgentProviderDefaultRequest
}
