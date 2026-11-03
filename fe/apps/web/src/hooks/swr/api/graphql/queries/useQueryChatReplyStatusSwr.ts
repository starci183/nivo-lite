"use client"

import {
    answeredData,
    terminalStatusOptions,
    workspaceArgumentKey,
    type ReadResponse,
    type WorkspaceReadKey,
} from "@/hooks/workspaceread"
import useSWR from "swr"
import type { StatusPollOptions } from "@/hooks/reuseables"
import { queryChatReplyStatus } from "@/modules/api/graphql/queries/query-chat-reply-status"
import type { ChatReplyStatusQuery } from "@/modules/api"

/** The SWR key of the chatReplyStatus query. */
export const QUERY_CHAT_REPLY_STATUS_SWR_KEY = "QUERY_CHAT_REPLY_STATUS_SWR"

/** How often the queued reply operation of a message is read again. */
const CHAT_REPLY_STATUS_REFRESH_MS = 1_000

/** Polls the queued reply operation of a message until it succeeds or fails. */
export const useQueryChatReplyStatusSwr = (
    workspaceId: string | undefined,
    messageId: string | undefined,
    options: StatusPollOptions = {},
): ReadResponse<ChatReplyStatusQuery["chatReplyStatus"]> =>
    useSWR(
        workspaceArgumentKey(QUERY_CHAT_REPLY_STATUS_SWR_KEY, workspaceId, messageId),
        async ([, , id]: WorkspaceReadKey<string>) => {
            return answeredData(await queryChatReplyStatus({ request: { messageId: id } }), "chatReplyStatus")
                .chatReplyStatus
        },
        terminalStatusOptions(CHAT_REPLY_STATUS_REFRESH_MS, options),
    )
