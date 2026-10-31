"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveAgentTrigger } from "@/modules/api/graphql/mutations/mutation-save-agent-trigger"
import type { MutateSaveAgentTriggerRequest } from "@/modules/api/graphql/mutations/mutation-save-agent-trigger"

/** What the SaveAgentTrigger mutation is triggered with. */
interface SaveAgentTriggerArg {
    readonly arg: MutateSaveAgentTriggerRequest
}

/** The SWR key of {@link useMutateSaveAgentTriggerSwr}. */
export const MUTATE_SAVE_AGENT_TRIGGER_SWR_KEY = "MUTATE_SAVE_AGENT_TRIGGER_SWR"

/** SWR mutation for {@link mutateSaveAgentTrigger}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSaveAgentTriggerSwr = () =>
    useSWRMutation(MUTATE_SAVE_AGENT_TRIGGER_SWR_KEY, async (_key: string, { arg }: SaveAgentTriggerArg) => {
        const result = await mutateSaveAgentTrigger({ request: arg })
        if (!result.data) throw new Error("saveAgentTrigger answered no data")
        return result.data.saveAgentTrigger
    })
