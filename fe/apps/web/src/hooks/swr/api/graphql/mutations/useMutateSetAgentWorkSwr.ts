"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateSetAgentWork,
    type MutateSetAgentWorkRequest,
} from "@/modules/api/graphql/mutations/mutation-set-agent-work"
import type { SWRMutationResponse } from "swr/mutation"
import type { SetAgentWorkMutation } from "@/modules/api"

/** What the SetAgentWork mutation is triggered with. */
interface SetAgentWorkArg {
    readonly arg: MutateSetAgentWorkRequest
}

/** The SWR key of {@link useMutateSetAgentWorkSwr}. */
export const MUTATE_SET_AGENT_WORK_SWR_KEY = "MUTATE_SET_AGENT_WORK_SWR"

/** SWR mutation for {@link mutateSetAgentWork}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSetAgentWorkSwr = (): SWRMutationResponse<
    SetAgentWorkMutation["setAgentWork"],
    Error,
    typeof MUTATE_SET_AGENT_WORK_SWR_KEY,
    SetAgentWorkArg["arg"]
> =>
    useSWRMutation(MUTATE_SET_AGENT_WORK_SWR_KEY, async (_key: string, { arg }: SetAgentWorkArg) => {
        const result = await mutateSetAgentWork({ request: arg })
        if (!result.data) throw new Error("setAgentWork answered no data")
        return result.data.setAgentWork
    })
