"use client"

import { answeredData, argumentKey, type ReadResponse } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryListTelegramChats } from "@/modules/api/graphql/queries/query-list-telegram-chats"
import type { ListTelegramChatsQuery } from "@/modules/api"

/** The SWR key of the listTelegramChats query. */
export const QUERY_LIST_TELEGRAM_CHATS_SWR_KEY = "QUERY_LIST_TELEGRAM_CHATS_SWR"

/** The recent chats of a personal Telegram account. The key carries the connection; `undefined` pauses it. */
export const useQueryListTelegramChatsSwr = (
    connectionId: string | undefined,
    options?: SWRConfiguration,
): ReadResponse<ListTelegramChatsQuery["listTelegramChats"]> =>
    useSWR(
        argumentKey(QUERY_LIST_TELEGRAM_CHATS_SWR_KEY, connectionId),
        async ([, input]: readonly [string, NonNullable<typeof connectionId>]) =>
            answeredData(
                await queryListTelegramChats({ request: { connectionId: input } }),
                QUERY_LIST_TELEGRAM_CHATS_SWR_KEY,
            ).listTelegramChats,
        options,
    )
