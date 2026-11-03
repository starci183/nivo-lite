"use client"

import { argumentKey, answeredData } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryTelegramConnectionPage } from "@/modules/api/graphql/queries/query-telegram-connection-page"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of the telegramPage query. */
export const QUERY_TELEGRAM_CONNECTION_PAGE_SWR_KEY = "QUERY_TELEGRAM_CONNECTION_PAGE_SWR_KEY"

/** The page of a Telegram bot connection. The key carries the connection; `undefined` pauses it. */
export const useQueryTelegramConnectionPageSwr = (
    connectionId: string | undefined,
    options?: SWRConfiguration,
): ReadResponse<OperationData<typeof queryTelegramConnectionPage>["telegramPage"]> =>
    useSWR(
        argumentKey(QUERY_TELEGRAM_CONNECTION_PAGE_SWR_KEY, connectionId),
        async ([, input]: readonly [string, NonNullable<typeof connectionId>]) =>
            answeredData(
                await queryTelegramConnectionPage({ request: { connectionId: input } }),
                QUERY_TELEGRAM_CONNECTION_PAGE_SWR_KEY,
            ).telegramPage,
        options,
    )
