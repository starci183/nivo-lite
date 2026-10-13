import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryTelegramUserReady } from "@/modules/api/graphql/queries/query-telegram-user-ready"

/** The SWR key of the telegramUserReady query. */
export const QUERY_TELEGRAM_USER_READY_SWR_KEY = "QUERY_TELEGRAM_USER_READY_SWR"

/** Whether personal Telegram login is available on this deployment. */
export const useQueryTelegramUserReadySwr = (options?: SWRConfiguration) =>
    useSWR(
        QUERY_TELEGRAM_USER_READY_SWR_KEY,
        async () => {
            const result = await queryTelegramUserReady()
            if (!result.data) throw new Error("telegramUserReady answered no data")
            return result.data.telegramUserReady
        },
        options,
    )
