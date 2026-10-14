"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import type { LoadOpenApiConnectionQuery } from "@/modules/api"
import { queryLoadOpenApiConnection } from "@/modules/api/graphql/queries/query-load-open-api-connection"

/** The SWR key of the loadOpenApiConnection query. */
export const QUERY_LOAD_OPEN_API_CONNECTION_SWR_KEY = "QUERY_LOAD_OPEN_API_CONNECTION_SWR"

/** A saved API connection for the wizard (resume). The key carries the connection; `undefined` pauses it. */
export const useQueryLoadOpenApiConnectionSwr = (
    connectionId: string | undefined,
    options?: SWRConfiguration<LoadOpenApiConnectionQuery["loadOpenApiConnection"]>,
) =>
    useSWR(
        connectionId === undefined ? null : ([QUERY_LOAD_OPEN_API_CONNECTION_SWR_KEY, connectionId] as const),
        async ([, id]) => {
            const result = await queryLoadOpenApiConnection({ request: { connectionId: id } })
            if (!result.data) throw new Error("loadOpenApiConnection answered no data")
            return result.data.loadOpenApiConnection
        },
        options,
    )
