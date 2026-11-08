"use client"

import { answeredData, argumentKey, type ReadResponse } from "@/hooks/workspaceread"
import useSWR, { type SWRConfiguration } from "swr"
import { queryZaloConnection } from "@/modules/api/graphql/queries/query-zalo-connection"
import type { ZaloConnectionQuery } from "@/modules/api"

/** The SWR key of the zaloConnection query. */
export const QUERY_ZALO_CONNECTION_SWR_KEY = "QUERY_ZALO_CONNECTION_SWR"

/** The Zalo wizard view of a connection (resume). The key carries the connection; `undefined` pauses it. */
export const useQueryZaloConnectionSwr = (
    connectionId: string | undefined,
    options?: SWRConfiguration,
): ReadResponse<ZaloConnectionQuery["zaloConnection"]> =>
    useSWR(
        argumentKey(QUERY_ZALO_CONNECTION_SWR_KEY, connectionId),
        async ([, input]: readonly [string, NonNullable<typeof connectionId>]) =>
            answeredData(await queryZaloConnection({ request: { connectionId: input } }), QUERY_ZALO_CONNECTION_SWR_KEY)
                .zaloConnection,
        options,
    )
