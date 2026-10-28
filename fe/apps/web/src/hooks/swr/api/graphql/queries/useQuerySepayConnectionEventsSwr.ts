"use client"

import { argumentKey, answeredData } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { querySepayConnectionEvents } from "@/modules/api/graphql/queries/query-sepay-connection-events"

/** The SWR key of the sepayConnectionEvents query. */
export const QUERY_SEPAY_CONNECTION_EVENTS_SWR_KEY = "QUERY_SEPAY_CONNECTION_EVENTS_SWR"

/** The newest webhook deliveries of one SePay connection. The key carries the connection; `undefined` pauses it. */
export const useQuerySepayConnectionEventsSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useSWR(
        argumentKey(QUERY_SEPAY_CONNECTION_EVENTS_SWR_KEY, connectionId),
        async ([, input]: readonly [string, NonNullable<typeof connectionId>]) =>
            answeredData(
                await querySepayConnectionEvents({ request: { connectionId: input } }),
                QUERY_SEPAY_CONNECTION_EVENTS_SWR_KEY,
            ).sepayConnectionEvents,
        options,
    )
