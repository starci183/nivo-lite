"use client"

import { workspaceArgumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryChatbotThread } from "@/modules/api/graphql/queries/query-chatbot-thread"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of the chatbotThread query. */
export const QUERY_CHATBOT_THREAD_SWR_KEY = "QUERY_CHATBOT_THREAD_SWR"

/** How often an open thread is read again. */
const CHATBOT_THREAD_REFRESH_MS = 3_000

/** The messages of one conversation, read again every three seconds. */
export const useQueryChatbotThreadSwr = (
    workspaceId: string | undefined,
    conversationId: string | undefined,
): ReadResponse<OperationData<typeof queryChatbotThread>["chatbotThread"]> =>
    useSWR(
        workspaceArgumentKey(QUERY_CHATBOT_THREAD_SWR_KEY, workspaceId, conversationId),
        async ([, , id]) => {
            const result = await queryChatbotThread({ request: { conversationId: id } })
            if (!result.data) throw new Error("chatbotThread answered no data")
            return result.data.chatbotThread
        },
        { refreshInterval: CHATBOT_THREAD_REFRESH_MS },
    )
