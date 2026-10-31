"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryDossierReviewSummary } from "@/modules/api/graphql/queries/query-dossier-review-summary"

/** The SWR key of the review summary; a write that changes the findings revalidates the keys that lead with it. */
export const QUERY_DOSSIER_REVIEW_SUMMARY_SWR_KEY = "QUERY_DOSSIER_REVIEW_SUMMARY_SWR"

/** How often the summary is asked again while a review run is going. */
const RUNNING_REFRESH_MS = 4_000

/** What the dossier review found in the active workspace and whether a run is going (the back end `dossierReviewSummary` query); asked again every few seconds only while a run is going. */
export const useQueryDossierReviewSummarySwr = () => {
    const key = useWorkspaceKey(QUERY_DOSSIER_REVIEW_SUMMARY_SWR_KEY, [])
    return useSWR(
        key,
        async ({ signal }: { signal?: AbortSignal } = {}) => {
            const result = await queryDossierReviewSummary({ signal })
            if (!result.data) throw new Error("dossierReviewSummary answered no data")
            return result.data.dossierReviewSummary
        },
        { refreshInterval: (data) => (data?.isRunning === true ? RUNNING_REFRESH_MS : 0) },
    )
}
