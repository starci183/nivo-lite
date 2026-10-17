"use client"

import { argumentKey, noData } from "@/hooks/workspaceread"
import useSWR from "swr"
import { querySalesWorkbench } from "@/modules/api/graphql/queries/query-sales-workbench"

/** Workspace-scoped cache identity for the salesWorkbench query. */
export const QUERY_SALES_WORKBENCH_SWR_KEY = "QUERY_SALES_WORKBENCH_SWR"

/** Reads salesWorkbench. The workspace id is part of the cache identity; `undefined` pauses the read. */
export const useQuerySalesWorkbenchSwr = (workspaceId: string | undefined) =>
    useSWR(
        argumentKey(QUERY_SALES_WORKBENCH_SWR_KEY, workspaceId),
        async () => (await querySalesWorkbench()).data?.salesWorkbench ?? noData("salesWorkbench"),
    )
