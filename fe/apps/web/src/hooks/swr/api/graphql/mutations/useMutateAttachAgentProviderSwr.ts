"use client"

import { mutateAttachAgentProvider, type MutateAttachAgentProviderRequest } from "@/modules/api/graphql/mutations/mutation-attach-agent-provider"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"

/** The SWR key of the attachAgentProvider mutation. */
export const MUTATE_ATTACH_AGENT_PROVIDER_SWR_KEY = "MUTATE_ATTACH_AGENT_PROVIDER_SWR"

/** SWR mutation for {@link mutateAttachAgentProvider}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAttachAgentProviderSwr = (): SWRMutationResponse<boolean, Error, typeof MUTATE_ATTACH_AGENT_PROVIDER_SWR_KEY, MutateAttachAgentProviderRequest> =>
    useSWRMutation(
        MUTATE_ATTACH_AGENT_PROVIDER_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateAttachAgentProvider({ request: arg }), MUTATE_ATTACH_AGENT_PROVIDER_SWR_KEY).attachAgentProvider,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateAttachAgentProviderRequest
}
