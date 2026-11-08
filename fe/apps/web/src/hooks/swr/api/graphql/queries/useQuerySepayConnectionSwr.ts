"use client"

import { answeredData, argumentKey, type ReadResponse } from "@/hooks/workspaceread"
import useSWR, { type SWRConfiguration } from "swr"
import { querySepayConnection } from "@/modules/api/graphql/queries/query-sepay-connection"
import type { SepayConnectionQuery } from "@/modules/api"

/** The SWR key of the sepayConnection query. */
export const QUERY_SEPAY_CONNECTION_SWR_KEY = "QUERY_SEPAY_CONNECTION_SWR"

/** The page read model of one SePay connection. The key carries the connection; `undefined` pauses it. */
export const useQuerySepayConnectionSwr = (
    connectionId: string | undefined,
    options?: SWRConfiguration,
): ReadResponse<SepayConnectionQuery["sepayConnection"]> =>
    useSWR(
        argumentKey(QUERY_SEPAY_CONNECTION_SWR_KEY, connectionId),
        async ([, input]: readonly [string, NonNullable<typeof connectionId>]) =>
            answeredData(
                await querySepayConnection({ request: { connectionId: input } }),
                QUERY_SEPAY_CONNECTION_SWR_KEY,
            ).sepayConnection,
        options,
    )
