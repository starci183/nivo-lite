"use client"

import {
    queryAskKnowledge,
    type queryAskKnowledge as QueryAskKnowledgeOperation,
} from "@/modules/api/graphql/queries/query-ask-knowledge"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { AskKnowledgeQuery } from "@/modules/api"

/** What the askKnowledge query is triggered with. */
interface AskKnowledgeArg {
    readonly arg: Parameters<typeof QueryAskKnowledgeOperation>[0]["request"]
}

/** The SWR key of the askKnowledge query. */
export const QUERY_ASK_KNOWLEDGE_SWR_KEY = "QUERY_ASK_KNOWLEDGE_SWR"

/** Lazy SWR query for {@link queryAskKnowledge}: `trigger(input)` answers retrieved passages and rejects with the back end failure. */
export const useQueryAskKnowledgeSwr = (): SWRMutationResponse<
    NonNullable<AskKnowledgeQuery["askKnowledge"]>,
    Error,
    typeof QUERY_ASK_KNOWLEDGE_SWR_KEY,
    AskKnowledgeArg["arg"]
> =>
    useSWRMutation(QUERY_ASK_KNOWLEDGE_SWR_KEY, async (_key: string, { arg }: AskKnowledgeArg) => {
        const result = await queryAskKnowledge({ request: arg })
        return result.data?.askKnowledge ?? []
    })
