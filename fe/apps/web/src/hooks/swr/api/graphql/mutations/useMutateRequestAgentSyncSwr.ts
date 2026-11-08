"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateRequestAgentSync,
    type MutateRequestAgentSyncRequest,
} from "@/modules/api/graphql/mutations/mutation-request-agent-sync"
import type { RequestAgentSyncMutation } from "@/modules/api"

/** What the RequestAgentSync mutation is triggered with. */
interface RequestAgentSyncArg {
    readonly arg: MutateRequestAgentSyncRequest
}

/** The SWR key of {@link useMutateRequestAgentSyncSwr}. */
export const MUTATE_REQUEST_AGENT_SYNC_SWR_KEY = "MUTATE_REQUEST_AGENT_SYNC_SWR"

/** SWR mutation for {@link mutateRequestAgentSync}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateRequestAgentSyncSwr = (): SWRMutationResponse<
    RequestAgentSyncMutation["requestAgentSync"],
    Error,
    typeof MUTATE_REQUEST_AGENT_SYNC_SWR_KEY,
    RequestAgentSyncArg["arg"]
> =>
    useSWRMutation(MUTATE_REQUEST_AGENT_SYNC_SWR_KEY, async (_key: string, { arg }: RequestAgentSyncArg) => {
        const result = await mutateRequestAgentSync({ request: arg })
        if (!result.data) throw new Error("requestAgentSync answered no data")
        return result.data.requestAgentSync
    })
