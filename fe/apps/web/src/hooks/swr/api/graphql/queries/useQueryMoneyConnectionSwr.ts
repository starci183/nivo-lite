"use client"

import { argumentKey, answeredData } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryMoneyConnection } from "@/modules/api/graphql/queries/query-money-connection"

/** The SWR key of the moneyConnection query. */
export const QUERY_MONEY_CONNECTION_SWR_KEY = "QUERY_MONEY_CONNECTION_SWR"

/** The bank and payment wizard view of a connection (resume). The key carries the connection; `undefined` pauses it. */
export const useQueryMoneyConnectionSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useSWR(
        argumentKey(QUERY_MONEY_CONNECTION_SWR_KEY, connectionId),
        async ([, input]: readonly [string, NonNullable<typeof connectionId>]) =>
            answeredData(
                await queryMoneyConnection({ request: { connectionId: input } }),
                QUERY_MONEY_CONNECTION_SWR_KEY,
            ).moneyConnection,
        options,
    )
