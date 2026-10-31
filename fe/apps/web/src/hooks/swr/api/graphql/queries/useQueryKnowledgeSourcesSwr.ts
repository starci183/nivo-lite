"use client"

import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import {
    queryKnowledgeSources,
    type QueryKnowledgeSourcesRequest,
} from "@/modules/api/graphql/queries/query-knowledge-sources"

/** The SWR key of the documents list; mutations that change it revalidate the keys that lead with it. */
export const QUERY_KNOWLEDGE_SOURCES_SWR_KEY = "QUERY_KNOWLEDGE_SOURCES_SWR"

const ACTIVE_STATUSES: ReadonlySet<string> = new Set(["pending", "queued", "reading", "indexing", "extracting_facts"])

/**
 * The documents of the active workspace, optionally filtered to one module (the back end `knowledgeSources` query).
 * Polls while a worker is on a document, so status and progress move on their own; `pollWhileWorking` false hands that to
 * the progress stream while it is open (the list is then read again on open and when a source settles).
 */
export const useQueryKnowledgeSourcesSwr = (input?: QueryKnowledgeSourcesRequest, pollWhileWorking = true) => {
    const key = useWorkspaceKey(QUERY_KNOWLEDGE_SOURCES_SWR_KEY, [input?.module ?? null])
    return useSWR(
        key,
        async ([, , module]: WorkspaceReadKey<string | null>) => {
            const result = await queryKnowledgeSources({ request: module === null ? {} : { module } })
            if (!result.data) throw new Error("knowledgeSources answered no data")
            return result.data.knowledgeSources
        },
        {
            refreshInterval: (data) =>
                pollWhileWorking && data?.some((one) => ACTIVE_STATUSES.has(one.status)) ? 3_000 : 0,
        },
    )
}
