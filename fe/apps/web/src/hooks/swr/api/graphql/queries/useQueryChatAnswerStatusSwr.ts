import { useStatusPollSwr } from "@/hooks/reuseables"
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
    useStatusPollSwr(
        workspaceId === undefined || workItemId === undefined
            ? null
            : [QUERY_CHAT_ANSWER_STATUS_SWR_KEY, workspaceId, workItemId],
        async ([, , id]) => {
            const result = await queryChatAnswerStatus({ request: { workItemId: id } })
            if (!result.data) throw new Error("chatAnswerStatus answered no data")
            return result.data.chatAnswerStatus
        },
        CHAT_ANSWER_STATUS_REFRESH_MS,
        options,
    )
