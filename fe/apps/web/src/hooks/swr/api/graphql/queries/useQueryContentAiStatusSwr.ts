"use client"

import type { SWRConfiguration } from "swr"
import { queryContentAiStatus } from "@/modules/api/graphql/queries/query-content-ai-status"
import { useWorkspaceQuerySwr } from "@/hooks/reuseables"
import type { ContentAiStatusType } from "@/modules/api"

/** The SWR key of the contentAiStatus query. */
export const QUERY_CONTENT_AI_STATUS_SWR_KEY = "QUERY_CONTENT_AI_STATUS_SWR"

/** What the reader of a job wants to hear: each answer of the status, and a failed read. */
type ContentAiStatusCallbacks = Pick<SWRConfiguration<ContentAiStatusType, Error>, "onSuccess" | "onError">

/** A queued content AI job, read every two seconds until it is done. */
export const useQueryContentAiStatusSwr = (id: string | undefined, callbacks: ContentAiStatusCallbacks) =>
    useWorkspaceQuerySwr(
        QUERY_CONTENT_AI_STATUS_SWR_KEY,
        id === undefined ? null : [id],
        ([jobId]) => queryContentAiStatus({ request: { id: jobId } }),
        (data) => data.contentAiStatus,
        {
            refreshInterval: (data) => (data?.status === "succeeded" || data?.status === "failed" ? 0 : 2000),
            revalidateOnFocus: false,
            ...callbacks,
        },
    )
