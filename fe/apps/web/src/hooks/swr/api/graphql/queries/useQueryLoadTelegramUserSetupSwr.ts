"use client"

import { useKeyedQuerySwr } from "@/hooks/reuseables"
import type { SWRConfiguration } from "swr"
import { queryLoadTelegramUserSetup } from "@/modules/api/graphql/queries/query-load-telegram-user-setup"

/** The SWR key of the loadTelegramUserSetup query. */
export const QUERY_LOAD_TELEGRAM_USER_SETUP_SWR_KEY = "QUERY_LOAD_TELEGRAM_USER_SETUP_SWR"

/** Where the personal Telegram wizard continues (resume). The key carries the connection; `undefined` pauses it. */
export const useQueryLoadTelegramUserSetupSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useKeyedQuerySwr(
        QUERY_LOAD_TELEGRAM_USER_SETUP_SWR_KEY,
        connectionId,
        (id) => queryLoadTelegramUserSetup({ request: { connectionId: id } }),
        (data) => data.loadTelegramUserSetup,
        options,
    )
