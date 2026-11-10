"use client"

import useSWRMutation from "swr/mutation"
import { mutateRollbackAgentWorkflow, type MutateRollbackAgentWorkflowRequest } from "@/modules/api/graphql/mutations/mutation-rollback-agent-workflow"
import type { SWRMutationResponse } from "swr/mutation"
import type { RollbackAgentWorkflowMutation } from "@/modules/api"

/** What the RollbackAgentWorkflow mutation is triggered with. */
interface RollbackAgentWorkflowArg {
    readonly arg: MutateRollbackAgentWorkflowRequest
}

/** The SWR key of {@link useMutateRollbackAgentWorkflowSwr}. */
export const MUTATE_ROLLBACK_AGENT_WORKFLOW_SWR_KEY = "MUTATE_ROLLBACK_AGENT_WORKFLOW_SWR"

/** SWR mutation for {@link mutateRollbackAgentWorkflow}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateRollbackAgentWorkflowSwr = (): SWRMutationResponse<RollbackAgentWorkflowMutation["rollbackAgentWorkflow"], Error, typeof MUTATE_ROLLBACK_AGENT_WORKFLOW_SWR_KEY, RollbackAgentWorkflowArg["arg"]> =>
    useSWRMutation(MUTATE_ROLLBACK_AGENT_WORKFLOW_SWR_KEY, async (_key: string, { arg }: RollbackAgentWorkflowArg) => {
        const result = await mutateRollbackAgentWorkflow({ request: arg })
        if (!result.data) throw new Error("rollbackAgentWorkflow answered no data")
        return result.data.rollbackAgentWorkflow
    })
