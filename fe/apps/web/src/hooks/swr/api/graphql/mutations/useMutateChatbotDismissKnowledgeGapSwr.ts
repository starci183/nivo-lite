"use client"

import {
    mutateChatbotDismissKnowledgeGap,
    type mutateChatbotDismissKnowledgeGap as MutateChatbotDismissKnowledgeGapOperation,
} from "@/modules/api/graphql/mutations/mutation-chatbot-dismiss-knowledge-gap"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { ChatbotDismissKnowledgeGapMutation } from "@/modules/api"

/** The SWR key of the dismissKnowledgeGap mutation. */
export const MUTATE_CHATBOT_DISMISS_KNOWLEDGE_GAP_SWR_KEY = "MUTATE_CHATBOT_DISMISS_KNOWLEDGE_GAP_SWR"

/** SWR mutation for {@link mutateChatbotDismissKnowledgeGap}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateChatbotDismissKnowledgeGapSwr = (): SWRMutationResponse<
    ChatbotDismissKnowledgeGapMutation["dismissKnowledgeGap"],
    Error,
    typeof MUTATE_CHATBOT_DISMISS_KNOWLEDGE_GAP_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_CHATBOT_DISMISS_KNOWLEDGE_GAP_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(
                await mutateChatbotDismissKnowledgeGap({ request: arg }),
                MUTATE_CHATBOT_DISMISS_KNOWLEDGE_GAP_SWR_KEY,
            ).dismissKnowledgeGap,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateChatbotDismissKnowledgeGapOperation>[0]["request"]
}
