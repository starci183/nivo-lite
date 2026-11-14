"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { useSWRConfig } from "swr"
import { matchesSwrKey } from "@/modules/utils"
import {
    mutateDecideAgentRunStep,
    type MutateDecideAgentRunStepRequest,
} from "@/modules/api/graphql/mutations/mutation-decide-agent-run-step"
import { QUERY_AGENT_RUN_SWR_KEY } from "../queries/useQueryAgentRunSwr"
import type { DecideAgentRunStepMutation } from "@/modules/api"

/** What the DecideAgentRunStep mutation is triggered with. */
interface DecideAgentRunStepArg {
    readonly arg: MutateDecideAgentRunStepRequest
}

/** The SWR key of {@link useMutateDecideAgentRunStepSwr}. */
export const MUTATE_DECIDE_AGENT_RUN_STEP_SWR_KEY = "MUTATE_DECIDE_AGENT_RUN_STEP_SWR"

/** SWR mutation for {@link mutateDecideAgentRunStep}: `trigger(request)` answers the outcome, and the run is read again so it shows where it went on. */
export const useMutateDecideAgentRunStepSwr = (): SWRMutationResponse<
    DecideAgentRunStepMutation["decideAgentRunStep"],
    Error,
    typeof MUTATE_DECIDE_AGENT_RUN_STEP_SWR_KEY,
    DecideAgentRunStepArg["arg"]
> => {
    const { mutate } = useSWRConfig()
    return useSWRMutation(
        MUTATE_DECIDE_AGENT_RUN_STEP_SWR_KEY,
        async (_key: string, { arg }: DecideAgentRunStepArg) => {
            const result = await mutateDecideAgentRunStep({ request: arg })
            if (!result.data) throw new Error("decideAgentRunStep answered no data")
            return result.data.decideAgentRunStep
        },
        { onSuccess: () => void mutate(matchesSwrKey(QUERY_AGENT_RUN_SWR_KEY)) },
    )
}
