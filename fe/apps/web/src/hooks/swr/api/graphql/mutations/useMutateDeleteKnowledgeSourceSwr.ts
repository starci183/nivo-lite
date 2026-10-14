"use client"

import useSWRMutation from "swr/mutation"
import { mutateDeleteKnowledgeSource } from "@/modules/api/graphql/mutations/mutation-delete-knowledge-source"
import type { MutateDeleteKnowledgeSourceRequest } from "@/modules/api/graphql/mutations/mutation-delete-knowledge-source"

/** What the DeleteKnowledgeSource mutation is triggered with. */
interface DeleteKnowledgeSourceArg {
    readonly arg: MutateDeleteKnowledgeSourceRequest
}

/** The SWR key of the deleteKnowledgeSource mutation. */
export const MUTATE_DELETE_KNOWLEDGE_SOURCE_SWR_KEY = "MUTATE_DELETE_KNOWLEDGE_SOURCE_SWR"

/** SWR mutation for {@link mutateDeleteKnowledgeSource}: Deletes a document of the workspace with its passages. `trigger(input)` rejects with the back end failure. */
export const useMutateDeleteKnowledgeSourceSwr = () =>
    useSWRMutation(MUTATE_DELETE_KNOWLEDGE_SOURCE_SWR_KEY, async (_key: string, { arg }: DeleteKnowledgeSourceArg) => {
        const result = await mutateDeleteKnowledgeSource({ request: arg })
        if (!result.data) throw new Error("deleteKnowledgeSource answered no data")
        return result.data.deleteKnowledgeSource
    })
