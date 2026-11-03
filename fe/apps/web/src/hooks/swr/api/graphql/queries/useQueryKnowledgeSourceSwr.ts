"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryKnowledgeSource } from "@/modules/api/graphql/queries/query-knowledge-source"
import type { KnowledgeSourceQuery } from "@/modules/api"

/** The SWR key of the document detail; mutations that change it revalidate the keys that lead with it. */
export const QUERY_KNOWLEDGE_SOURCE_SWR_KEY = "QUERY_KNOWLEDGE_SOURCE_SWR"

const ACTIVE_STATUSES: ReadonlySet<string> = new Set(["pending", "queued", "reading", "indexing", "extracting_facts"])

/**
 * One document of the active workspace with its text and passages (the back end `knowledgeSource` query). Polls while a
 * worker is on it.
 */
export const useQueryKnowledgeSourceSwr = (
    id: string | undefined,
): ReadResponse<KnowledgeSourceQuery["knowledgeSource"]> => {
    const key = useWorkspaceKey(QUERY_KNOWLEDGE_SOURCE_SWR_KEY, [id ?? ""], id !== undefined)
    return useSWR(
        key,
        async ([, , sourceId]: WorkspaceReadKey<string>) => {
            return answeredData(await queryKnowledgeSource({ request: { id: sourceId } }), "knowledgeSource")
                .knowledgeSource
        },
        {
            refreshInterval: (data) => (data !== undefined && ACTIVE_STATUSES.has(data.source.status) ? 3_000 : 0),
        },
    )
}
