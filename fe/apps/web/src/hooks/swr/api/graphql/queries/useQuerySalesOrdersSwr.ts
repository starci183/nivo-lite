"use client"

import useSWRInfinite from "swr/infinite"
import type { SWRInfiniteKeyLoader } from "swr/infinite"
import { connectionPageKey, connectionPageView, connectionReadParameters } from "@/hooks/connectionPages"
import type { ConnectionPage, ConnectionPageKey } from "@/hooks/connectionPages"
import { noData } from "@/hooks/workspaceread"
import { querySalesOrders } from "@/modules/api/graphql/queries/query-sales-orders"
import { GraphQLHeadersKey } from "@/modules/api"
import type { SalesOrdersQuery } from "@/modules/api"

/** The workspace sales order connection cache. */
export const QUERY_SALES_ORDERS_SWR_KEY = "QUERY_SALES_ORDERS_SWR"

type SalesOrdersPage = ConnectionPage<SalesOrdersQuery["salesOrders"]["nodes"][number]>

/** Reads the loaded sales order pages for the active workspace. */
export const useQuerySalesOrdersSwr = (workspaceId: string | undefined) => {
    const getKey: SWRInfiniteKeyLoader<SalesOrdersPage, ConnectionPageKey | null> = (index, previous) =>
        connectionPageKey(QUERY_SALES_ORDERS_SWR_KEY, workspaceId, index, previous)
    const query = useSWRInfinite<SalesOrdersPage, Error>(
        getKey,
        async (key: ConnectionPageKey) =>
            (await querySalesOrders(connectionReadParameters(key, GraphQLHeadersKey.XWorkspaceId))).data?.salesOrders ??
            noData("salesOrders"),
        { persistSize: false, keepPreviousData: false, revalidateAll: true },
    )
    return connectionPageView(query)
}
