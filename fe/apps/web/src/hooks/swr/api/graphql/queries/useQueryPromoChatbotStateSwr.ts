import { noData, useWorkspaceSwr } from "@/hooks/workspaceread"
import { queryPromoChatbotState } from "@/modules/api/graphql/queries/query-promo-chatbot-state"

/** Workspace-scoped cache identity for the promoChatbotState query. */
export const QUERY_PROMO_CHATBOT_STATE_SWR_KEY = "QUERY_PROMO_CHATBOT_STATE_SWR"

/** Reads promoChatbotState. The workspace id is part of the cache identity; `undefined` pauses the read. */
export const useQueryPromoChatbotStateSwr = (workspaceId: string | undefined) =>
    useWorkspaceSwr(
        QUERY_PROMO_CHATBOT_STATE_SWR_KEY,
        workspaceId,
        async () => (await queryPromoChatbotState()).data?.promoChatbotState ?? noData("promoChatbotState"),
    )
