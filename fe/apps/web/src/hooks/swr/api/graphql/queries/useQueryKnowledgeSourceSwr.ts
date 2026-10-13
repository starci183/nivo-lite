import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryKnowledgeSource } from "@/modules/api/graphql/queries/query-knowledge-source"

/** The SWR key of the document detail; mutations that change it revalidate the keys that lead with it. */
export const QUERY_KNOWLEDGE_SOURCE_SWR_KEY = "QUERY_KNOWLEDGE_SOURCE_SWR"

const ACTIVE_STATUSES: ReadonlyArray<string> = ["pending", "queued", "reading", "indexing", "extracting_facts"]

/**
 * One document of the active workspace with its text and passages (the back end `knowledgeSource` query). Polls while a
 * worker is on it.
 */
export const useQueryKnowledgeSourceSwr = (id: string | undefined) => {
    const key = useWorkspaceKey(QUERY_KNOWLEDGE_SOURCE_SWR_KEY, [id ?? ""], id !== undefined)
    return useSWR(
        key,
        async ([, , sourceId]: readonly [string, string, string]) => {
            const result = await queryKnowledgeSource({ request: { id: sourceId } })
            if (!result.data) throw new Error("knowledgeSource answered no data")
            return result.data.knowledgeSource
        },
        {
            refreshInterval: (data) => (data !== undefined && ACTIVE_STATUSES.includes(data.source.status) ? 3_000 : 0),
        },
    )
}
