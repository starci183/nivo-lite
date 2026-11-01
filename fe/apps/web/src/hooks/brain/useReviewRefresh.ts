"use client"

import { useCallback } from "react"
import { useSWRConfig } from "swr"
import {
    QUERY_DOSSIER_FINDINGS_SWR_KEY,
    QUERY_DOSSIER_REMEDY_DRAFT_SWR_KEY,
    QUERY_BRAIN_TODO_SWR_KEY,
    QUERY_DOSSIER_REVIEW_SUMMARY_SWR_KEY,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"

/** The reads every write of the review changes besides the lists of findings: the summary, the drafts and the count of what needs the owner. */
const REVIEW_READS: ReadonlyArray<string> = [
    QUERY_DOSSIER_REVIEW_SUMMARY_SWR_KEY,
    QUERY_DOSSIER_REMEDY_DRAFT_SWR_KEY,
    QUERY_BRAIN_TODO_SWR_KEY,
]

/** A cache key of the findings connection (any filter), so a write refreshes every list that shows findings. */
const isFindingsCacheKey = (key: unknown): key is string =>
    typeof key === "string" && key.startsWith("$inf$") && key.includes(QUERY_DOSSIER_FINDINGS_SWR_KEY)

/** A cache key of one of the named reads. */
const isReadOf = (names: ReadonlyArray<string>) => (key: unknown) =>
    Array.isArray(key) && typeof key[0] === "string" && names.includes(key[0])

/**
 * Runs one write of the dossier review: toasts its outcome and, once it went through, refreshes exactly the lists of findings,
 * the summary and the draft, with the extra reads the write changes (an approval adds a document). Answers undefined when the
 * write failed.
 */
export const useReviewRefresh = () => {
    const runGraphQL = useGraphQLWithToast()
    const { cache, mutate } = useSWRConfig()
    return useCallback(
        async <Answer>(action: () => Promise<Answer>, done: string, reads: ReadonlyArray<string> = []) => {
            const answer = await runGraphQL(action, { successMessage: done })
            if (answer === undefined) return undefined
            const lists = [...cache.keys()].filter(isFindingsCacheKey)
            await Promise.all([...lists.map((key) => mutate(key)), mutate(isReadOf([...REVIEW_READS, ...reads]))])
            return answer
        },
        [runGraphQL, cache, mutate],
    )
}
