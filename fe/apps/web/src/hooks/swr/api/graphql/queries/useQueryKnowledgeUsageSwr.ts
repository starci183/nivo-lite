"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryKnowledgeUsage } from "@/modules/api/graphql/queries/query-knowledge-usage"

/** The SWR key of the document allowance; mutations that change the documents revalidate the keys that lead with it. */
export const QUERY_KNOWLEDGE_USAGE_SWR_KEY = "QUERY_KNOWLEDGE_USAGE_SWR"

/** How much of its raw document allowance the active workspace has used (the back end `knowledgeUsage` query). */
export const useQueryKnowledgeUsageSwr = () => {
    const key = useWorkspaceKey(QUERY_KNOWLEDGE_USAGE_SWR_KEY, [])
    return useSWR(key, async () => {
        const result = await queryKnowledgeUsage()
        if (!result.data) throw new Error("knowledgeUsage answered no data")
        return result.data.knowledgeUsage
    })
}
