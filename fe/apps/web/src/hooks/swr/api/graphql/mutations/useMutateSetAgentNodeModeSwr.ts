"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { mutateSetAgentNodeMode, type MutateSetAgentNodeModeRequest } from "@/modules/api/graphql/mutations/mutation-set-agent-node-mode"
import type { SetAgentNodeModeMutation } from "@/modules/api"

/** What the SetAgentNodeMode mutation is triggered with. */
interface SetAgentNodeModeArg {
    readonly arg: MutateSetAgentNodeModeRequest
}

/** The SWR key of {@link useMutateSetAgentNodeModeSwr}. */
export const MUTATE_SET_AGENT_NODE_MODE_SWR_KEY = "MUTATE_SET_AGENT_NODE_MODE_SWR"

/** SWR mutation for {@link mutateSetAgentNodeMode}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSetAgentNodeModeSwr = (): SWRMutationResponse<SetAgentNodeModeMutation["setAgentNodeMode"], Error, typeof MUTATE_SET_AGENT_NODE_MODE_SWR_KEY, SetAgentNodeModeArg["arg"]> =>
    useSWRMutation(MUTATE_SET_AGENT_NODE_MODE_SWR_KEY, async (_key: string, { arg }: SetAgentNodeModeArg) => {
        const result = await mutateSetAgentNodeMode({ request: arg })
        if (!result.data) throw new Error("setAgentNodeMode answered no data")
        return result.data.setAgentNodeMode
    })
