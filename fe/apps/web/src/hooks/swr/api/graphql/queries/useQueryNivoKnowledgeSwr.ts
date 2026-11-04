"use client"

import useSWR from "swr"
import { queryNivoKnowledge } from "@/modules/api/graphql/queries/query-nivo-knowledge"
import type { ReadResponse } from "@/hooks/workspaceread"
import type { NivoKnowledgeQuery } from "@/modules/api"

/** The SWR key of the base knowledge read; it changes only with the back end itself. */
export const QUERY_NIVO_KNOWLEDGE_SWR_KEY = "QUERY_NIVO_KNOWLEDGE_SWR"

/** The base knowledge of NIVO every workspace reads (the back end `nivoKnowledge` query). */
export const useQueryNivoKnowledgeSwr = (): ReadResponse<NivoKnowledgeQuery["nivoKnowledge"]> =>
    useSWR(QUERY_NIVO_KNOWLEDGE_SWR_KEY, async ({ signal }: { signal?: AbortSignal } = {}) => {
        const result = await queryNivoKnowledge({ signal })
        if (!result.data) throw new Error("nivoKnowledge answered no data")
        return result.data.nivoKnowledge
    })
