"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateEnqueueKnowledgeSource,
    type MutateEnqueueKnowledgeSourceRequest,
} from "@/modules/api/graphql/mutations/mutation-enqueue-knowledge-source"
import type { EnqueueKnowledgeSourceMutation } from "@/modules/api"

/** What the EnqueueKnowledgeSource mutation is triggered with. */
interface EnqueueKnowledgeSourceArg {
    readonly arg: MutateEnqueueKnowledgeSourceRequest
}

/** The SWR key of the enqueueKnowledgeSource mutation. */
export const MUTATE_ENQUEUE_KNOWLEDGE_SOURCE_SWR_KEY = "MUTATE_ENQUEUE_KNOWLEDGE_SOURCE_SWR"

/** SWR mutation for {@link mutateEnqueueKnowledgeSource}: Adds a document and queues its indexing; answers the new document id. `trigger(input)` rejects with the back end failure. */
export const useMutateEnqueueKnowledgeSourceSwr = (): SWRMutationResponse<
    EnqueueKnowledgeSourceMutation["enqueueKnowledgeSource"],
    Error,
    typeof MUTATE_ENQUEUE_KNOWLEDGE_SOURCE_SWR_KEY,
    EnqueueKnowledgeSourceArg["arg"]
> =>
    useSWRMutation(
        MUTATE_ENQUEUE_KNOWLEDGE_SOURCE_SWR_KEY,
        async (_key: string, { arg }: EnqueueKnowledgeSourceArg) => {
            const result = await mutateEnqueueKnowledgeSource({ request: arg })
            if (!result.data) throw new Error("enqueueKnowledgeSource answered no data")
            return result.data.enqueueKnowledgeSource
        },
    )
