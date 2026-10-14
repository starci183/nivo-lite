"use client"

import { useKeyedQuerySwr } from "@/hooks/reuseables"
import type { SWRConfiguration } from "swr"
import { queryZaloConnection } from "@/modules/api/graphql/queries/query-zalo-connection"

/** The SWR key of the zaloConnection query. */
export const QUERY_ZALO_CONNECTION_SWR_KEY = "QUERY_ZALO_CONNECTION_SWR"

/** The Zalo wizard view of a connection (resume). The key carries the connection; `undefined` pauses it. */
export const useQueryZaloConnectionSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useKeyedQuerySwr(
        QUERY_ZALO_CONNECTION_SWR_KEY,
        connectionId,
        (id) => queryZaloConnection({ request: { connectionId: id } }),
        (data) => data.zaloConnection,
        options,
    )
