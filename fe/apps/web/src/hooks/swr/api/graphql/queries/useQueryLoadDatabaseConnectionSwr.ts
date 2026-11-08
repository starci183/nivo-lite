"use client"

import { answeredData, argumentKey, type ReadResponse } from "@/hooks/workspaceread"
import useSWR, { type SWRConfiguration } from "swr"
import { queryLoadDatabaseConnection } from "@/modules/api/graphql/queries/query-load-database-connection"
import type { LoadDatabaseConnectionQuery } from "@/modules/api"

/** The SWR key of the loadDatabaseConnection query. */
export const QUERY_LOAD_DATABASE_CONNECTION_SWR_KEY = "QUERY_LOAD_DATABASE_CONNECTION_SWR"

/** A saved database connection reopened for editing. The key carries the connection; `undefined` pauses it. */
export const useQueryLoadDatabaseConnectionSwr = (
    connectionId: string | undefined,
    options?: SWRConfiguration,
): ReadResponse<LoadDatabaseConnectionQuery["loadDatabaseConnection"]> =>
    useSWR(
        argumentKey(QUERY_LOAD_DATABASE_CONNECTION_SWR_KEY, connectionId),
        async ([, input]: readonly [string, NonNullable<typeof connectionId>]) =>
            answeredData(
                await queryLoadDatabaseConnection({ request: { connectionId: input } }),
                QUERY_LOAD_DATABASE_CONNECTION_SWR_KEY,
            ).loadDatabaseConnection,
        options,
    )
