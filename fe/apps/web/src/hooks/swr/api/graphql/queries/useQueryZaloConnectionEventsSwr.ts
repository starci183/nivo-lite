"use client"

import { answeredData, argumentKey, type ReadResponse } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryZaloConnectionEvents } from "@/modules/api/graphql/queries/query-zalo-connection-events"
import type { ZaloConnectionEventsQuery } from "@/modules/api"

/** The SWR key of the zaloConnectionEvents query. */
export const QUERY_ZALO_CONNECTION_EVENTS_SWR_KEY = "QUERY_ZALO_CONNECTION_EVENTS_SWR_KEY"

/** The live events of a Zalo OA connection. The key carries the connection; `undefined` pauses it. */
export const useQueryZaloConnectionEventsSwr = (
    connectionId: string | undefined,
    options?: SWRConfiguration,
): ReadResponse<ZaloConnectionEventsQuery["zaloConnectionEvents"]> =>
    useSWR(
        argumentKey(QUERY_ZALO_CONNECTION_EVENTS_SWR_KEY, connectionId),
        async ([, input]: readonly [string, NonNullable<typeof connectionId>]) =>
            answeredData(
                await queryZaloConnectionEvents({ request: { connectionId: input } }),
                QUERY_ZALO_CONNECTION_EVENTS_SWR_KEY,
            ).zaloConnectionEvents,
        options,
    )
