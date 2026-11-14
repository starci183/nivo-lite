"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateResumeAgentRun,
    type MutateResumeAgentRunRequest,
} from "@/modules/api/graphql/mutations/mutation-resume-agent-run"
import type { ResumeAgentRunMutation } from "@/modules/api"

/** What the ResumeAgentRun mutation is triggered with. */
interface ResumeAgentRunArg {
    readonly arg: MutateResumeAgentRunRequest
}

/** The SWR key of {@link useMutateResumeAgentRunSwr}. */
export const MUTATE_RESUME_AGENT_RUN_SWR_KEY = "MUTATE_RESUME_AGENT_RUN_SWR"

/** SWR mutation for {@link mutateResumeAgentRun}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateResumeAgentRunSwr = (): SWRMutationResponse<
    ResumeAgentRunMutation["resumeAgentRun"],
    Error,
    typeof MUTATE_RESUME_AGENT_RUN_SWR_KEY,
    ResumeAgentRunArg["arg"]
> =>
    useSWRMutation(MUTATE_RESUME_AGENT_RUN_SWR_KEY, async (_key: string, { arg }: ResumeAgentRunArg) => {
        const result = await mutateResumeAgentRun({ request: arg })
        if (!result.data) throw new Error("resumeAgentRun answered no data")
        return result.data.resumeAgentRun
    })
