"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { mutateAgreeAgentNodeRights, type MutateAgreeAgentNodeRightsRequest } from "@/modules/api/graphql/mutations/mutation-agree-agent-node-rights"
import type { AgreeAgentNodeRightsMutation } from "@/modules/api"

/** The SWR key of {@link useMutateAgreeAgentNodeRightsSwr}. */
export const MUTATE_AGREE_AGENT_NODE_RIGHTS_SWR_KEY = "MUTATE_AGREE_AGENT_NODE_RIGHTS_SWR"

/** SWR mutation for {@link mutateAgreeAgentNodeRights}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateAgreeAgentNodeRightsSwr = (): SWRMutationResponse<AgreeAgentNodeRightsMutation["agreeAgentNodeRights"], Error, typeof MUTATE_AGREE_AGENT_NODE_RIGHTS_SWR_KEY, MutateAgreeAgentNodeRightsRequest> =>
    useSWRMutation(MUTATE_AGREE_AGENT_NODE_RIGHTS_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateAgreeAgentNodeRights({ request: arg })
        if (!result.data) throw new Error("agreeAgentNodeRights answered no data")
        return result.data.agreeAgentNodeRights
    })

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateAgreeAgentNodeRightsRequest
}
