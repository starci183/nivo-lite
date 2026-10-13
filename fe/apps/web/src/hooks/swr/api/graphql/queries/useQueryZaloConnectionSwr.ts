import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryZaloConnection } from "@/modules/api/graphql/queries/query-zalo-connection"

/** The SWR key of the zaloConnection query. */
export const QUERY_ZALO_CONNECTION_SWR_KEY = "QUERY_ZALO_CONNECTION_SWR"

/** The Zalo wizard view of a connection (resume). The key carries the connection; `undefined` pauses it. */
export const useQueryZaloConnectionSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useSWR(
        connectionId === undefined ? null : ([QUERY_ZALO_CONNECTION_SWR_KEY, connectionId] as const),
        async ([, id]) => {
            const result = await queryZaloConnection({ request: { connectionId: id } })
            if (!result.data) throw new Error("zaloConnection answered no data")
            return result.data.zaloConnection
        },
        options,
    )
