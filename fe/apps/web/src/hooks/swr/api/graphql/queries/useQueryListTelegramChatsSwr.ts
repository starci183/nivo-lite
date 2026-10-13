import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryListTelegramChats } from "@/modules/api/graphql/queries/query-list-telegram-chats"

/** The SWR key of the listTelegramChats query. */
export const QUERY_LIST_TELEGRAM_CHATS_SWR_KEY = "QUERY_LIST_TELEGRAM_CHATS_SWR"

/** The recent chats of a personal Telegram account. The key carries the connection; `undefined` pauses it. */
export const useQueryListTelegramChatsSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useSWR(
        connectionId === undefined ? null : ([QUERY_LIST_TELEGRAM_CHATS_SWR_KEY, connectionId] as const),
        async ([, id]) => {
            const result = await queryListTelegramChats({ request: { connectionId: id } })
            if (!result.data) throw new Error("listTelegramChats answered no data")
            return result.data.listTelegramChats
        },
        options,
    )
