"use client"

import useSWRMutation from "swr/mutation"
import { mutateDraftLeadExecution } from "@/modules/api/graphql/mutations/mutation-draft-lead-execution"
import type { MutateDraftLeadExecutionRequest } from "@/modules/api/graphql/mutations/mutation-draft-lead-execution"

/** What the draft lead execution mutation is triggered with. */
interface DraftLeadExecutionArg {
    readonly arg: MutateDraftLeadExecutionRequest
}

/** The SWR key of the draft lead execution mutation. */
export const MUTATE_DRAFT_LEAD_EXECUTION_SWR_KEY = "MUTATE_DRAFT_LEAD_EXECUTION_SWR"

/** SWR mutation for {@link mutateDraftLeadExecution}: `trigger({ responsibilityId })` answers the queued draft and rejects with the back end failure. */
export const useMutateDraftLeadExecutionSwr = () =>
    useSWRMutation(MUTATE_DRAFT_LEAD_EXECUTION_SWR_KEY, async (_key: string, { arg }: DraftLeadExecutionArg) => {
        const result = await mutateDraftLeadExecution({ request: arg })
        if (!result.data) throw new Error("draftLeadExecution answered no data")
        return result.data.draftLeadExecution
    })
