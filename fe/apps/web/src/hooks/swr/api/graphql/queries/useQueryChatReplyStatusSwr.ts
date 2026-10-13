import { useStatusPollSwr } from "@/hooks/reuseables/useStatusPollSwr"
import type { StatusPollOptions } from "@/hooks/reuseables/useStatusPollSwr"
import { queryChatReplyStatus } from "@/modules/api/graphql/queries/query-chat-reply-status"

/** The SWR key of the chatReplyStatus query. */
export const QUERY_CHAT_REPLY_STATUS_SWR_KEY = "QUERY_CHAT_REPLY_STATUS_SWR"

/** How often the queued reply operation of a message is read again. */
const CHAT_REPLY_STATUS_REFRESH_MS = 1_000

/** Polls the queued reply operation of a message until it succeeds or fails. */
export const useQueryChatReplyStatusSwr = (
    workspaceId: string | undefined,
    messageId: string | undefined,
    options: StatusPollOptions = {},
) =>
    useStatusPollSwr(
        workspaceId === undefined || messageId === undefined
            ? null
            : [QUERY_CHAT_REPLY_STATUS_SWR_KEY, workspaceId, messageId],
        async ([, , id]) => {
            const result = await queryChatReplyStatus({ request: { messageId: id } })
            if (!result.data) throw new Error("chatReplyStatus answered no data")
            return result.data.chatReplyStatus
        },
        CHAT_REPLY_STATUS_REFRESH_MS,
        options,
    )
