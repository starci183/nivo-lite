"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateCloseAgentTask,
    type MutateCloseAgentTaskRequest,
} from "@/modules/api/graphql/mutations/mutation-close-agent-task"
import type { SWRMutationResponse } from "swr/mutation"
import type { CloseAgentTaskMutation } from "@/modules/api"

/** What the CloseAgentTask mutation is triggered with. */
interface CloseAgentTaskArg {
    readonly arg: MutateCloseAgentTaskRequest
}

/** The SWR key of {@link useMutateCloseAgentTaskSwr}. */
export const MUTATE_CLOSE_AGENT_TASK_SWR_KEY = "MUTATE_CLOSE_AGENT_TASK_SWR"

/** SWR mutation for {@link mutateCloseAgentTask}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateCloseAgentTaskSwr = (): SWRMutationResponse<
    CloseAgentTaskMutation["closeAgentTask"],
    Error,
    typeof MUTATE_CLOSE_AGENT_TASK_SWR_KEY,
    CloseAgentTaskArg["arg"]
> =>
    useSWRMutation(MUTATE_CLOSE_AGENT_TASK_SWR_KEY, async (_key: string, { arg }: CloseAgentTaskArg) => {
        const result = await mutateCloseAgentTask({ request: arg })
        if (!result.data) throw new Error("closeAgentTask answered no data")
        return result.data.closeAgentTask
    })
