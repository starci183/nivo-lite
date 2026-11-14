"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import { queryBrainPolicies } from "@/modules/api/graphql/queries/query-brain-policies"
import type { BrainPoliciesQuery } from "@/modules/api"

/** The SWR key of the shop rules; a write on a rule or a decision on its proposals revalidates the keys that lead with it. */
export const QUERY_BRAIN_POLICIES_SWR_KEY = "QUERY_BRAIN_POLICIES_SWR"

/** How many times a failed read of the rules is tried again: the tab shows its own failure, the header simply has no count. */
const RETRIES = 2

/** How often the tab asks again while a derive pass is queued or running. */
const DERIVING_REFRESH_MS = 4000

/**
 * The shop rules in force in the truth graph (the back end `brainPolicies` query): one row per fact, grouped by subject, with the value
 * scheduled next and the proposals waiting. While a derive pass runs the answer is asked again every few seconds. The tab and the count chip on the Second Brain header read this one cached answer.
 */
export const useQueryBrainPoliciesSwr = (): ReadResponse<BrainPoliciesQuery["brainPolicies"]> => {
    const key = useWorkspaceKey(QUERY_BRAIN_POLICIES_SWR_KEY, [])
    return useSWR(
        key,
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryBrainPolicies({ signal }), "brainPolicies").brainPolicies,
        {
            errorRetryCount: RETRIES,
            refreshInterval: (data) => (data?.derivation.state === "deriving" ? DERIVING_REFRESH_MS : 0),
        },
    )
}
