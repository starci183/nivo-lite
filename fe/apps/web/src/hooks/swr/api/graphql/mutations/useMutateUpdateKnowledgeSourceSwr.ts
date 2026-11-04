"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateUpdateKnowledgeSource,
    type MutateUpdateKnowledgeSourceRequest,
} from "@/modules/api/graphql/mutations/mutation-update-knowledge-source"
import type { SWRMutationResponse } from "swr/mutation"
import type { UpdateKnowledgeSourceMutation } from "@/modules/api"

/** What the UpdateKnowledgeSource mutation is triggered with. */
interface UpdateKnowledgeSourceArg {
    readonly arg: MutateUpdateKnowledgeSourceRequest
}

/** The SWR key of the updateKnowledgeSource mutation. */
export const MUTATE_UPDATE_KNOWLEDGE_SOURCE_SWR_KEY = "MUTATE_UPDATE_KNOWLEDGE_SOURCE_SWR"

/** SWR mutation for {@link mutateUpdateKnowledgeSource}: Changes the details of a document: module, topic, tags, title or visibility. `trigger(input)` rejects with the back end failure. */
export const useMutateUpdateKnowledgeSourceSwr = (): SWRMutationResponse<
    UpdateKnowledgeSourceMutation["updateKnowledgeSource"],
    Error,
    typeof MUTATE_UPDATE_KNOWLEDGE_SOURCE_SWR_KEY,
    UpdateKnowledgeSourceArg["arg"]
> =>
    useSWRMutation(MUTATE_UPDATE_KNOWLEDGE_SOURCE_SWR_KEY, async (_key: string, { arg }: UpdateKnowledgeSourceArg) => {
        const result = await mutateUpdateKnowledgeSource({ request: arg })
        if (!result.data) throw new Error("updateKnowledgeSource answered no data")
        return result.data.updateKnowledgeSource
    })
