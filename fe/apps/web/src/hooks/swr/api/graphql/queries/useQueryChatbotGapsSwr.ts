"use client"

import { argumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryChatbotGaps } from "@/modules/api/graphql/queries/query-chatbot-gaps"

/** The SWR key of the chatbotGaps query. */
export const QUERY_CHATBOT_GAPS_SWR_KEY = "QUERY_CHATBOT_GAPS_SWR"

/** The open knowledge gaps of the workspace chatbot. */
export const useQueryChatbotGapsSwr = (workspaceId: string | undefined) =>
    useSWR(argumentKey(QUERY_CHATBOT_GAPS_SWR_KEY, workspaceId), async () => {
        const result = await queryChatbotGaps()
        if (!result.data) throw new Error("chatbotGaps answered no data")
        return result.data.chatbotGaps
    })
