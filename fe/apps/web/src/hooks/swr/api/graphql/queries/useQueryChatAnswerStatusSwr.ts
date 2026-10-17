"use client"

import { workspaceArgumentKey, terminalStatusOptions } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { StatusPollOptions } from "@/hooks/reuseables"
import { queryChatAnswerStatus } from "@/modules/api/graphql/queries/query-chat-answer-status"

/** The SWR key of the chatAnswerStatus query. */
export const QUERY_CHAT_ANSWER_STATUS_SWR_KEY = "QUERY_CHAT_ANSWER_STATUS_SWR"

/** How often the queued answer operation of a work item is read again. */
const CHAT_ANSWER_STATUS_REFRESH_MS = 1_000

/** Polls the queued answer operation of a work item until it succeeds or fails. */
export const useQueryChatAnswerStatusSwr = (
    workspaceId: string | undefined,
    workItemId: string | undefined,
    options: StatusPollOptions = {},
) =>
    useSWR(
        workspaceArgumentKey(QUERY_CHAT_ANSWER_STATUS_SWR_KEY, workspaceId, workItemId),
        async ([, , id]: WorkspaceReadKey<string>) => {
            const result = await queryChatAnswerStatus({ request: { workItemId: id } })
            if (!result.data) throw new Error("chatAnswerStatus answered no data")
            return result.data.chatAnswerStatus
        },
        terminalStatusOptions(CHAT_ANSWER_STATUS_REFRESH_MS, options),
    )
