"use client"

import useSWRMutation from "swr/mutation"
import { mutateSetAgentWorkflowStatus, type MutateSetAgentWorkflowStatusRequest } from "@/modules/api/graphql/mutations/mutation-set-agent-workflow-status"
import type { SWRMutationResponse } from "swr/mutation"
import type { SetAgentWorkflowStatusMutation } from "@/modules/api"

/** What the SetAgentWorkflowStatus mutation is triggered with. */
interface SetAgentWorkflowStatusArg {
    readonly arg: MutateSetAgentWorkflowStatusRequest
}

/** The SWR key of {@link useMutateSetAgentWorkflowStatusSwr}. */
export const MUTATE_SET_AGENT_WORKFLOW_STATUS_SWR_KEY = "MUTATE_SET_AGENT_WORKFLOW_STATUS_SWR"

/** SWR mutation for {@link mutateSetAgentWorkflowStatus}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSetAgentWorkflowStatusSwr = (): SWRMutationResponse<SetAgentWorkflowStatusMutation["setAgentWorkflowStatus"], Error, typeof MUTATE_SET_AGENT_WORKFLOW_STATUS_SWR_KEY, SetAgentWorkflowStatusArg["arg"]> =>
    useSWRMutation(MUTATE_SET_AGENT_WORKFLOW_STATUS_SWR_KEY, async (_key: string, { arg }: SetAgentWorkflowStatusArg) => {
        const result = await mutateSetAgentWorkflowStatus({ request: arg })
        if (!result.data) throw new Error("setAgentWorkflowStatus answered no data")
        return result.data.setAgentWorkflowStatus
    })
