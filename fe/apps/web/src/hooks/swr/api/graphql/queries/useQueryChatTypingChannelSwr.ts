"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryChatTypingChannel } from "@/modules/api/graphql/queries/query-chat-typing-channel"
import type { QueryChatTypingChannelRequest } from "@/modules/api/graphql/queries/query-chat-typing-channel"

/** The SWR key of {@link useQueryChatTypingChannelSwr}. */
export const QUERY_CHAT_TYPING_CHANNEL_SWR_KEY = "QUERY_CHAT_TYPING_CHANNEL_SWR"

/** The back end `chatTypingChannel` query: the private broadcast topic of one target. Pass `null` to wait for a target. */
export const useQueryChatTypingChannelSwr = (
    request: QueryChatTypingChannelRequest | null,
    config?: SWRConfiguration,
) =>
    useSWR(
        useWorkspaceKey(QUERY_CHAT_TYPING_CHANNEL_SWR_KEY, [JSON.stringify(request)], request !== null),
        async () =>
            request === null ? undefined : (await queryChatTypingChannel({ request })).data?.chatTypingChannel,
        config,
    )
