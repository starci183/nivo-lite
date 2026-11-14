"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import { queryBrainCritiqueSources } from "@/modules/api/graphql/queries/query-brain-critique-sources"
import type { BrainCritiqueSourcesQuery } from "@/modules/api"

/** The SWR key of {@link useQueryBrainCritiqueSourcesSwr}. */
export const QUERY_BRAIN_CRITIQUE_SOURCES_SWR_KEY = "QUERY_BRAIN_CRITIQUE_SOURCES_SWR"

/** Every document the critic has a view of, with open / high point counts (the back end `brainCritiqueSources` query). */
export const useQueryBrainCritiqueSourcesSwr = (
    enabled = true,
): ReadResponse<BrainCritiqueSourcesQuery["brainCritiqueSources"]> =>
    useSWR(
        useWorkspaceKey(QUERY_BRAIN_CRITIQUE_SOURCES_SWR_KEY, [], enabled),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryBrainCritiqueSources({ signal }), QUERY_BRAIN_CRITIQUE_SOURCES_SWR_KEY)
                .brainCritiqueSources,
    )
