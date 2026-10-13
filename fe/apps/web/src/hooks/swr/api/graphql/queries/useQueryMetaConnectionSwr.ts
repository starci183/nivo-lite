import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryMetaConnection } from "@/modules/api/graphql/queries/query-meta-connection"

/** The SWR key of the metaConnection query. */
export const QUERY_META_CONNECTION_SWR_KEY = "QUERY_META_CONNECTION_SWR"

/** The Meta wizard view of a connection (resume). The key carries the connection; `undefined` pauses it. */
export const useQueryMetaConnectionSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useSWR(
        connectionId === undefined ? null : ([QUERY_META_CONNECTION_SWR_KEY, connectionId] as const),
        async ([, id]) => {
            const result = await queryMetaConnection({ request: { connectionId: id } })
            if (!result.data) throw new Error("metaConnection answered no data")
            return result.data.metaConnection
        },
        options,
    )
