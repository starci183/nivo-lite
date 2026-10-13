import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryLoadDatabaseConnection } from "@/modules/api/graphql/queries/query-load-database-connection"

/** The SWR key of the loadDatabaseConnection query. */
export const QUERY_LOAD_DATABASE_CONNECTION_SWR_KEY = "QUERY_LOAD_DATABASE_CONNECTION_SWR"

/** A saved database connection reopened for editing. The key carries the connection; `undefined` pauses it. */
export const useQueryLoadDatabaseConnectionSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useSWR(
        connectionId === undefined ? null : ([QUERY_LOAD_DATABASE_CONNECTION_SWR_KEY, connectionId] as const),
        async ([, id]) => {
            const result = await queryLoadDatabaseConnection({ request: { connectionId: id } })
            if (!result.data) throw new Error("loadDatabaseConnection answered no data")
            return result.data.loadDatabaseConnection
        },
        options,
    )
