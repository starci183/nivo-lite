"use client"

import { argumentKey, answeredData } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryZaloConnectionPage } from "@/modules/api/graphql/queries/query-zalo-connection-page"

/** The SWR key of the zaloConnectionPage query. */
export const QUERY_ZALO_CONNECTION_PAGE_SWR_KEY = "QUERY_ZALO_CONNECTION_PAGE_SWR_KEY"

/** The page of a Zalo OA connection. The key carries the connection; `undefined` pauses it. */
export const useQueryZaloConnectionPageSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useSWR(
        argumentKey(QUERY_ZALO_CONNECTION_PAGE_SWR_KEY, connectionId),
        async ([, input]: readonly [string, NonNullable<typeof connectionId>]) =>
            answeredData(
                await queryZaloConnectionPage({ request: { connectionId: input } }),
                QUERY_ZALO_CONNECTION_PAGE_SWR_KEY,
            ).zaloConnectionPage,
        options,
    )
