"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryChatTypingChannel } from "@/modules/api/graphql/queries/query-chat-typing-channel"
import type {
    QueryChatTypingChannelRequest,
    QueryChatTypingChannelResult,
} from "@/modules/api/graphql/queries/query-chat-typing-channel"

/** The SWR key of {@link useQueryChatTypingChannelSwr}. */
export const QUERY_CHAT_TYPING_CHANNEL_SWR_KEY = "QUERY_CHAT_TYPING_CHANNEL_SWR"

/** One target and its authorized private typing channel. */
interface ChatTypingChannelAnswer {
    readonly request: QueryChatTypingChannelRequest
    readonly channel: QueryChatTypingChannelResult | undefined
}

/** The back end `chatTypingChannel` query for every listed target, in the order asked. */
export const useQueryChatTypingChannelSwr = (
    targets: ReadonlyArray<QueryChatTypingChannelRequest>,
    config?: SWRConfiguration<ReadonlyArray<ChatTypingChannelAnswer>>,
) =>
    useSWR(
        useWorkspaceKey(QUERY_CHAT_TYPING_CHANNEL_SWR_KEY, [JSON.stringify(targets)]),
        async (): Promise<ReadonlyArray<ChatTypingChannelAnswer>> =>
            Promise.all(
                targets.map(async (request) => ({
                    request,
                    channel: (await queryChatTypingChannel({ request })).data?.chatTypingChannel,
                })),
            ),
        config,
    )
