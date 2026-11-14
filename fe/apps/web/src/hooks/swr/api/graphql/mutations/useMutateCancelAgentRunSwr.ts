"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateCancelAgentRun,
    type MutateCancelAgentRunRequest,
} from "@/modules/api/graphql/mutations/mutation-cancel-agent-run"
import type { CancelAgentRunMutation } from "@/modules/api"

/** What the CancelAgentRun mutation is triggered with. */
interface CancelAgentRunArg {
    readonly arg: MutateCancelAgentRunRequest
}

/** The SWR key of {@link useMutateCancelAgentRunSwr}. */
export const MUTATE_CANCEL_AGENT_RUN_SWR_KEY = "MUTATE_CANCEL_AGENT_RUN_SWR"

/** SWR mutation for {@link mutateCancelAgentRun}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateCancelAgentRunSwr = (): SWRMutationResponse<
    CancelAgentRunMutation["cancelAgentRun"],
    Error,
    typeof MUTATE_CANCEL_AGENT_RUN_SWR_KEY,
    CancelAgentRunArg["arg"]
> =>
    useSWRMutation(MUTATE_CANCEL_AGENT_RUN_SWR_KEY, async (_key: string, { arg }: CancelAgentRunArg) => {
        const result = await mutateCancelAgentRun({ request: arg })
        if (!result.data) throw new Error("cancelAgentRun answered no data")
        return result.data.cancelAgentRun
    })
