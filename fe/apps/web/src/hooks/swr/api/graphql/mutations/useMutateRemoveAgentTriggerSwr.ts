"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateRemoveAgentTrigger,
    type MutateRemoveAgentTriggerRequest,
} from "@/modules/api/graphql/mutations/mutation-remove-agent-trigger"
import type { RemoveAgentTriggerMutation } from "@/modules/api"

/** What the RemoveAgentTrigger mutation is triggered with. */
interface RemoveAgentTriggerArg {
    readonly arg: MutateRemoveAgentTriggerRequest
}

/** The SWR key of {@link useMutateRemoveAgentTriggerSwr}. */
export const MUTATE_REMOVE_AGENT_TRIGGER_SWR_KEY = "MUTATE_REMOVE_AGENT_TRIGGER_SWR"

/** SWR mutation for {@link mutateRemoveAgentTrigger}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateRemoveAgentTriggerSwr = (): SWRMutationResponse<
    RemoveAgentTriggerMutation["removeAgentTrigger"],
    Error,
    typeof MUTATE_REMOVE_AGENT_TRIGGER_SWR_KEY,
    RemoveAgentTriggerArg["arg"]
> =>
    useSWRMutation(MUTATE_REMOVE_AGENT_TRIGGER_SWR_KEY, async (_key: string, { arg }: RemoveAgentTriggerArg) => {
        const result = await mutateRemoveAgentTrigger({ request: arg })
        if (!result.data) throw new Error("removeAgentTrigger answered no data")
        return result.data.removeAgentTrigger
    })
