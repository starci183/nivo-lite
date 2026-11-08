"use client"

import useSWR, { type SWRResponse } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryKnowledgeCategories } from "@/modules/api/graphql/queries/query-knowledge-categories"
import type { KnowledgeCategoriesQuery } from "@/modules/api"

/** The SWR key of the categories of the documents; mutations that change the documents revalidate the keys that lead with it. */
export const QUERY_KNOWLEDGE_CATEGORIES_SWR_KEY = "QUERY_KNOWLEDGE_CATEGORIES_SWR"

/** What each category (topic) of the documents of the active workspace holds (the back end `knowledgeCategories` query). */
export const useQueryKnowledgeCategoriesSwr = (): SWRResponse<
    KnowledgeCategoriesQuery["knowledgeCategories"],
    Error
> => {
    const key = useWorkspaceKey(QUERY_KNOWLEDGE_CATEGORIES_SWR_KEY, [])
    return useSWR(key, async () => {
        const result = await queryKnowledgeCategories()
        if (!result.data) throw new Error("knowledgeCategories answered no data")
        return result.data.knowledgeCategories
    })
}
