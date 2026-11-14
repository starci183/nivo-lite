"use client"

import useSWR from "swr"
import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import { queryBrainCritique, type QueryBrainCritiqueRequest } from "@/modules/api/graphql/queries/query-brain-critique"
import type { BrainCritiqueQuery } from "@/modules/api"

/** The SWR key of {@link useQueryBrainCritiqueSwr}; answers to a point revalidate the keys that lead with it. */
export const QUERY_BRAIN_CRITIQUE_SWR_KEY = "QUERY_BRAIN_CRITIQUE_SWR"

/** How often a critique that is still being read is asked again. */
const RUNNING_POLL_MS = 5_000

const READING_STATES: ReadonlySet<string> = new Set(["running", "waiting"])

/** The critic's view of one document (the back end `brainCritique` query). Pass `null` to wait for the document id. Polls while the review runs. */
export const useQueryBrainCritiqueSwr = (
    request: QueryBrainCritiqueRequest | null,
): ReadResponse<BrainCritiqueQuery["brainCritique"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_BRAIN_CRITIQUE_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryBrainCritiqueRequest>) =>
            answeredData(await queryBrainCritique({ request: input }), QUERY_BRAIN_CRITIQUE_SWR_KEY).brainCritique,
        { refreshInterval: (data) => (data !== undefined && READING_STATES.has(data.review.state) ? RUNNING_POLL_MS : 0) },
    )
