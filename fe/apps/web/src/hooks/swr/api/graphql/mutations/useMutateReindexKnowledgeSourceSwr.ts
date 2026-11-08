"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateReindexKnowledgeSource,
    type MutateReindexKnowledgeSourceRequest,
} from "@/modules/api/graphql/mutations/mutation-reindex-knowledge-source"
import type { ReindexKnowledgeSourceMutation } from "@/modules/api"

/** What the ReindexKnowledgeSource mutation is triggered with. */
interface ReindexKnowledgeSourceArg {
    readonly arg: MutateReindexKnowledgeSourceRequest
}

/** The SWR key of the reindexKnowledgeSource mutation. */
export const MUTATE_REINDEX_KNOWLEDGE_SOURCE_SWR_KEY = "MUTATE_REINDEX_KNOWLEDGE_SOURCE_SWR"

/** SWR mutation for {@link mutateReindexKnowledgeSource}: Reads a document again and indexes it from scratch. `trigger(input)` rejects with the back end failure. */
export const useMutateReindexKnowledgeSourceSwr = (): SWRMutationResponse<
    ReindexKnowledgeSourceMutation["reindexKnowledgeSource"],
    Error,
    typeof MUTATE_REINDEX_KNOWLEDGE_SOURCE_SWR_KEY,
    ReindexKnowledgeSourceArg["arg"]
> =>
    useSWRMutation(
        MUTATE_REINDEX_KNOWLEDGE_SOURCE_SWR_KEY,
        async (_key: string, { arg }: ReindexKnowledgeSourceArg) => {
            const result = await mutateReindexKnowledgeSource({ request: arg })
            if (!result.data) throw new Error("reindexKnowledgeSource answered no data")
            return result.data.reindexKnowledgeSource
        },
    )
