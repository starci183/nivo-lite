import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryMoneyConnection } from "@/modules/api/graphql/queries/query-money-connection"

/** The SWR key of the moneyConnection query. */
export const QUERY_MONEY_CONNECTION_SWR_KEY = "QUERY_MONEY_CONNECTION_SWR"

/** The bank and payment wizard view of a connection (resume). The key carries the connection; `undefined` pauses it. */
export const useQueryMoneyConnectionSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useSWR(
        connectionId === undefined ? null : ([QUERY_MONEY_CONNECTION_SWR_KEY, connectionId] as const),
        async ([, id]) => {
            const result = await queryMoneyConnection({ request: { connectionId: id } })
            if (!result.data) throw new Error("moneyConnection answered no data")
            return result.data.moneyConnection
        },
        options,
    )
