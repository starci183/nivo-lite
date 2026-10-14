"use client"

import { useKeyedQuerySwr } from "@/hooks/reuseables"
import type { SWRConfiguration } from "swr"
import { queryLoadDatabaseConnection } from "@/modules/api/graphql/queries/query-load-database-connection"

/** The SWR key of the loadDatabaseConnection query. */
export const QUERY_LOAD_DATABASE_CONNECTION_SWR_KEY = "QUERY_LOAD_DATABASE_CONNECTION_SWR"

/** A saved database connection reopened for editing. The key carries the connection; `undefined` pauses it. */
export const useQueryLoadDatabaseConnectionSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useKeyedQuerySwr(
        QUERY_LOAD_DATABASE_CONNECTION_SWR_KEY,
        connectionId,
        (id) => queryLoadDatabaseConnection({ request: { connectionId: id } }),
        (data) => data.loadDatabaseConnection,
        options,
    )
