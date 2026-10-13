import { useKeyedQuerySwr } from "@/hooks/reuseables"
import type { SWRConfiguration } from "swr"
import { queryListTelegramChats } from "@/modules/api/graphql/queries/query-list-telegram-chats"

/** The SWR key of the listTelegramChats query. */
export const QUERY_LIST_TELEGRAM_CHATS_SWR_KEY = "QUERY_LIST_TELEGRAM_CHATS_SWR"

/** The recent chats of a personal Telegram account. The key carries the connection; `undefined` pauses it. */
export const useQueryListTelegramChatsSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useKeyedQuerySwr(
        QUERY_LIST_TELEGRAM_CHATS_SWR_KEY,
        connectionId,
        (id) => queryListTelegramChats({ request: { connectionId: id } }),
        (data) => data.listTelegramChats,
        options,
    )
