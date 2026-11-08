"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateDeleteKnowledgeSource,
    type MutateDeleteKnowledgeSourceRequest,
} from "@/modules/api/graphql/mutations/mutation-delete-knowledge-source"
import type { DeleteKnowledgeSourceMutation } from "@/modules/api"

/** What the DeleteKnowledgeSource mutation is triggered with. */
interface DeleteKnowledgeSourceArg {
    readonly arg: MutateDeleteKnowledgeSourceRequest
}

/** The SWR key of the deleteKnowledgeSource mutation. */
export const MUTATE_DELETE_KNOWLEDGE_SOURCE_SWR_KEY = "MUTATE_DELETE_KNOWLEDGE_SOURCE_SWR"

/** SWR mutation for {@link mutateDeleteKnowledgeSource}: Deletes a document of the workspace with its passages. `trigger(input)` rejects with the back end failure. */
export const useMutateDeleteKnowledgeSourceSwr = (): SWRMutationResponse<
    DeleteKnowledgeSourceMutation["deleteKnowledgeSource"],
    Error,
    typeof MUTATE_DELETE_KNOWLEDGE_SOURCE_SWR_KEY,
    DeleteKnowledgeSourceArg["arg"]
> =>
    useSWRMutation(MUTATE_DELETE_KNOWLEDGE_SOURCE_SWR_KEY, async (_key: string, { arg }: DeleteKnowledgeSourceArg) => {
        const result = await mutateDeleteKnowledgeSource({ request: arg })
        if (!result.data) throw new Error("deleteKnowledgeSource answered no data")
        return result.data.deleteKnowledgeSource
    })
