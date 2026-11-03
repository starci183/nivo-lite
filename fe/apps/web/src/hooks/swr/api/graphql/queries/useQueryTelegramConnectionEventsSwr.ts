"use client"

import { argumentKey, answeredData } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryTelegramConnectionEvents } from "@/modules/api/graphql/queries/query-telegram-connection-events"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of the telegramEvents query. */
export const QUERY_TELEGRAM_CONNECTION_EVENTS_SWR_KEY = "QUERY_TELEGRAM_CONNECTION_EVENTS_SWR_KEY"

/** The live events of a Telegram bot connection. The key carries the connection; `undefined` pauses it. */
export const useQueryTelegramConnectionEventsSwr = (
    connectionId: string | undefined,
    options?: SWRConfiguration,
): ReadResponse<OperationData<typeof queryTelegramConnectionEvents>["telegramEvents"]> =>
    useSWR(
        argumentKey(QUERY_TELEGRAM_CONNECTION_EVENTS_SWR_KEY, connectionId),
        async ([, input]: readonly [string, NonNullable<typeof connectionId>]) =>
            answeredData(
                await queryTelegramConnectionEvents({ request: { connectionId: input } }),
                QUERY_TELEGRAM_CONNECTION_EVENTS_SWR_KEY,
            ).telegramEvents,
        options,
    )
