"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import { queryBrainPolicy } from "@/modules/api/graphql/queries/query-brain-policy"
import type { BrainPolicyQuery } from "@/modules/api"
import { QUERY_BRAIN_POLICIES_SWR_KEY } from "./useQueryBrainPoliciesSwr"

/** The SWR key of one shop rule; it leads with the key of the rules, so revalidating the rules refreshes the opened one too. */
export const QUERY_BRAIN_POLICY_SWR_KEY: string = `${QUERY_BRAIN_POLICIES_SWR_KEY}:ONE`

/** One shop rule with its waiting proposals and its history (the back end `brainPolicy` query). Pass `null` while no rule is open. */
export const useQueryBrainPolicySwr = (factId: string | null): ReadResponse<BrainPolicyQuery["brainPolicy"]> =>
    useSWR(
        useWorkspaceKey(QUERY_BRAIN_POLICY_SWR_KEY, [factId], factId !== null && factId !== ""),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryBrainPolicy({ request: { factId: factId ?? "" }, signal }), "brainPolicy")
                .brainPolicy,
        { errorRetryCount: 1 },
    )
