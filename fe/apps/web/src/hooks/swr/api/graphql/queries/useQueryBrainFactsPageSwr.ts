"use client"

import useSWR from "swr"
import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import { queryBrainFactsPage, type QueryBrainFactsPageRequest } from "@/modules/api/graphql/queries/query-brain-facts-page"
import type { BrainFactsPageQuery } from "@/modules/api"

/** The SWR key of {@link useQueryBrainFactsPageSwr}; fact decisions revalidate the keys that lead with it. */
export const QUERY_BRAIN_FACTS_PAGE_SWR_KEY = "QUERY_BRAIN_FACTS_PAGE_SWR"

/** One server-side page of the Second Brain facts (`brain(facts: ...)`): filters, cursor and total from the back end. Pass `null` to wait. */
export const useQueryBrainFactsPageSwr = (
    request: QueryBrainFactsPageRequest | null,
): ReadResponse<BrainFactsPageQuery["brain"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_BRAIN_FACTS_PAGE_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryBrainFactsPageRequest>) =>
            answeredData(await queryBrainFactsPage({ request: input }), QUERY_BRAIN_FACTS_PAGE_SWR_KEY).brain,
        { keepPreviousData: true },
    )
