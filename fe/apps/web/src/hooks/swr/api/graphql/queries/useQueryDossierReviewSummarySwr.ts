"use client"

import { useRef } from "react"
import useSWR, { useSWRConfig } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { answeredData } from "@/hooks/workspaceread"
import { queryDossierReviewSummary } from "@/modules/api/graphql/queries/query-dossier-review-summary"
import { QUERY_BRAIN_TODO_SWR_KEY } from "./useQueryBrainTodoSwr"

/** The SWR key of the review summary; a write that changes the findings revalidates the keys that lead with it. */
export const QUERY_DOSSIER_REVIEW_SUMMARY_SWR_KEY = "QUERY_DOSSIER_REVIEW_SUMMARY_SWR"

/** How often the summary is asked again while a review run is going. */
const RUNNING_REFRESH_MS = 4_000

/**
 * What the dossier review found in the active workspace and whether a run is going (the back end `dossierReviewSummary` query); asked again
 * every few seconds only while a run is going. When a run that was going has ended, the count of what needs the owner is read again,
 * since the run wrote its findings.
 */
export const useQueryDossierReviewSummarySwr = () => {
    const key = useWorkspaceKey(QUERY_DOSSIER_REVIEW_SUMMARY_SWR_KEY, [])
    const { mutate } = useSWRConfig()
    const wasRunning = useRef(false)
    return useSWR(
        key,
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryDossierReviewSummary({ signal }), "dossierReviewSummary").dossierReviewSummary,
        {
            refreshInterval: (data) => (data?.isRunning === true ? RUNNING_REFRESH_MS : 0),
            onSuccess: (data) => {
                if (wasRunning.current && !data.isRunning) {
                    void mutate((read) => Array.isArray(read) && read[0] === QUERY_BRAIN_TODO_SWR_KEY)
                }
                wasRunning.current = data.isRunning
            },
        },
    )
}
