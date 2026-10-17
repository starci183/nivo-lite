"use client"

import { argumentKey, answeredData } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryConnectionFirstEvent } from "@/modules/api/graphql/queries/query-connection-first-event"

/** The SWR key of the connectionFirstEvent query. */
export const QUERY_CONNECTION_FIRST_EVENT_SWR_KEY = "QUERY_CONNECTION_FIRST_EVENT_SWR"

/** Whether a connection already received its first event. The key carries the connection; `undefined` pauses it. */
export const useQueryConnectionFirstEventSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useSWR(
        argumentKey(QUERY_CONNECTION_FIRST_EVENT_SWR_KEY, connectionId),
        async ([, input]: readonly [string, NonNullable<typeof connectionId>]) =>
            answeredData(
                await queryConnectionFirstEvent({ request: { connectionId: input } }),
                QUERY_CONNECTION_FIRST_EVENT_SWR_KEY,
            ).connectionFirstEvent,
        options,
    )
