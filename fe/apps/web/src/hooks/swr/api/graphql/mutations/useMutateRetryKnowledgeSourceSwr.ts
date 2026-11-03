"use client"

import useSWRMutation from "swr/mutation"
import { mutateRetryKnowledgeSource } from "@/modules/api/graphql/mutations/mutation-retry-knowledge-source"
import type { MutateRetryKnowledgeSourceRequest } from "@/modules/api/graphql/mutations/mutation-retry-knowledge-source"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the RetryKnowledgeSource mutation is triggered with. */
interface RetryKnowledgeSourceArg {
    readonly arg: MutateRetryKnowledgeSourceRequest
}

/** The SWR key of the retryKnowledgeSource mutation. */
export const MUTATE_RETRY_KNOWLEDGE_SOURCE_SWR_KEY = "MUTATE_RETRY_KNOWLEDGE_SOURCE_SWR"

/** SWR mutation for {@link mutateRetryKnowledgeSource}: Sends a failed document back to the job queue. `trigger(input)` rejects with the back end failure. */
export const useMutateRetryKnowledgeSourceSwr = (): SWRMutationResponse<
    OperationData<typeof mutateRetryKnowledgeSource>["retryKnowledgeSource"],
    Error,
    typeof MUTATE_RETRY_KNOWLEDGE_SOURCE_SWR_KEY,
    RetryKnowledgeSourceArg["arg"]
> =>
    useSWRMutation(MUTATE_RETRY_KNOWLEDGE_SOURCE_SWR_KEY, async (_key: string, { arg }: RetryKnowledgeSourceArg) => {
        const result = await mutateRetryKnowledgeSource({ request: arg })
        if (!result.data) throw new Error("retryKnowledgeSource answered no data")
        return result.data.retryKnowledgeSource
    })
