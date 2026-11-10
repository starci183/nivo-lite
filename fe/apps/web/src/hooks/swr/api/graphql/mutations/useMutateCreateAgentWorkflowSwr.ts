"use client"

import useSWRMutation from "swr/mutation"
import { mutateCreateAgentWorkflow, type MutateCreateAgentWorkflowRequest } from "@/modules/api/graphql/mutations/mutation-create-agent-workflow"
import type { SWRMutationResponse } from "swr/mutation"
import type { CreateAgentWorkflowMutation } from "@/modules/api"

/** What the CreateAgentWorkflow mutation is triggered with. */
interface CreateAgentWorkflowArg {
    readonly arg: MutateCreateAgentWorkflowRequest
}

/** The SWR key of {@link useMutateCreateAgentWorkflowSwr}. */
export const MUTATE_CREATE_AGENT_WORKFLOW_SWR_KEY = "MUTATE_CREATE_AGENT_WORKFLOW_SWR"

/** SWR mutation for {@link mutateCreateAgentWorkflow}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateCreateAgentWorkflowSwr = (): SWRMutationResponse<CreateAgentWorkflowMutation["createAgentWorkflow"], Error, typeof MUTATE_CREATE_AGENT_WORKFLOW_SWR_KEY, CreateAgentWorkflowArg["arg"]> =>
    useSWRMutation(MUTATE_CREATE_AGENT_WORKFLOW_SWR_KEY, async (_key: string, { arg }: CreateAgentWorkflowArg) => {
        const result = await mutateCreateAgentWorkflow({ request: arg })
        if (!result.data) throw new Error("createAgentWorkflow answered no data")
        return result.data.createAgentWorkflow
    })
