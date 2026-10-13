import { mutateChatbotDismissKnowledgeGap } from "@/modules/api/graphql/mutations/mutation-chatbot-dismiss-knowledge-gap"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the dismissKnowledgeGap mutation. */
export const MUTATE_CHATBOT_DISMISS_KNOWLEDGE_GAP_SWR_KEY = "MUTATE_CHATBOT_DISMISS_KNOWLEDGE_GAP_SWR"

/** SWR mutation for {@link mutateChatbotDismissKnowledgeGap}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateChatbotDismissKnowledgeGapSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_CHATBOT_DISMISS_KNOWLEDGE_GAP_SWR_KEY,
        mutateChatbotDismissKnowledgeGap,
        (data) => data.dismissKnowledgeGap,
    )
