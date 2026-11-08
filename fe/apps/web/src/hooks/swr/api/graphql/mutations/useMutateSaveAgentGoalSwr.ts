"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateSaveAgentGoal,
    type MutateSaveAgentGoalRequest,
} from "@/modules/api/graphql/mutations/mutation-save-agent-goal"
import type { SaveAgentGoalMutation } from "@/modules/api"

/** What the SaveAgentGoal mutation is triggered with. */
interface SaveAgentGoalArg {
    readonly arg: MutateSaveAgentGoalRequest
}

/** The SWR key of {@link useMutateSaveAgentGoalSwr}. */
export const MUTATE_SAVE_AGENT_GOAL_SWR_KEY = "MUTATE_SAVE_AGENT_GOAL_SWR"

/** SWR mutation for {@link mutateSaveAgentGoal}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSaveAgentGoalSwr = (): SWRMutationResponse<
    SaveAgentGoalMutation["saveAgentGoal"],
    Error,
    typeof MUTATE_SAVE_AGENT_GOAL_SWR_KEY,
    SaveAgentGoalArg["arg"]
> =>
    useSWRMutation(MUTATE_SAVE_AGENT_GOAL_SWR_KEY, async (_key: string, { arg }: SaveAgentGoalArg) => {
        const result = await mutateSaveAgentGoal({ request: arg })
        if (!result.data) throw new Error("saveAgentGoal answered no data")
        return result.data.saveAgentGoal
    })
