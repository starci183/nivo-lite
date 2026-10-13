import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryConnectionFirstEvent } from "@/modules/api/graphql/queries/query-connection-first-event"

/** The SWR key of the connectionFirstEvent query. */
export const QUERY_CONNECTION_FIRST_EVENT_SWR_KEY = "QUERY_CONNECTION_FIRST_EVENT_SWR"

/** Whether a connection already received its first event. The key carries the connection; `undefined` pauses it. */
export const useQueryConnectionFirstEventSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useSWR(
        connectionId === undefined ? null : ([QUERY_CONNECTION_FIRST_EVENT_SWR_KEY, connectionId] as const),
        async ([, id]) => {
            const result = await queryConnectionFirstEvent({ request: { connectionId: id } })
            if (!result.data) throw new Error("connectionFirstEvent answered no data")
            return result.data.connectionFirstEvent
        },
        options,
    )
