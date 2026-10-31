"use client"

import useSWRMutation from "swr/mutation"
import { mutateSetWorkspaceAgentWork } from "@/modules/api/graphql/mutations/mutation-set-workspace-agent-work"
import type { MutateSetWorkspaceAgentWorkRequest } from "@/modules/api/graphql/mutations/mutation-set-workspace-agent-work"

/** What the SetWorkspaceAgentWork mutation is triggered with. */
interface SetWorkspaceAgentWorkArg {
    readonly arg: MutateSetWorkspaceAgentWorkRequest
}

/** The SWR key of {@link useMutateSetWorkspaceAgentWorkSwr}. */
export const MUTATE_SET_WORKSPACE_AGENT_WORK_SWR_KEY = "MUTATE_SET_WORKSPACE_AGENT_WORK_SWR"

/** SWR mutation for {@link mutateSetWorkspaceAgentWork}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSetWorkspaceAgentWorkSwr = () =>
    useSWRMutation(MUTATE_SET_WORKSPACE_AGENT_WORK_SWR_KEY, async (_key: string, { arg }: SetWorkspaceAgentWorkArg) => {
        const result = await mutateSetWorkspaceAgentWork({ request: arg })
        if (!result.data) throw new Error("setWorkspaceAgentWork answered no data")
        return result.data.setWorkspaceAgentWork
    })
