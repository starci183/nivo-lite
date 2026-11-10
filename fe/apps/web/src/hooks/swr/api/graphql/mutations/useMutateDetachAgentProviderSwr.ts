"use client"

import { mutateDetachAgentProvider, type MutateDetachAgentProviderRequest } from "@/modules/api/graphql/mutations/mutation-detach-agent-provider"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"

/** The SWR key of the detachAgentProvider mutation. */
export const MUTATE_DETACH_AGENT_PROVIDER_SWR_KEY = "MUTATE_DETACH_AGENT_PROVIDER_SWR"

/** SWR mutation for {@link mutateDetachAgentProvider}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateDetachAgentProviderSwr = (): SWRMutationResponse<boolean, Error, typeof MUTATE_DETACH_AGENT_PROVIDER_SWR_KEY, MutateDetachAgentProviderRequest> =>
    useSWRMutation(
        MUTATE_DETACH_AGENT_PROVIDER_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateDetachAgentProvider({ request: arg }), MUTATE_DETACH_AGENT_PROVIDER_SWR_KEY).detachAgentProvider,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateDetachAgentProviderRequest
}
