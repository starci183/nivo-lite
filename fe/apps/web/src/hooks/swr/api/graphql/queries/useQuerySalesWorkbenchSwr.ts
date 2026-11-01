"use client"

import { argumentKey, noData } from "@/hooks/workspaceread"
import useSWR from "swr"
import { querySalesWorkbench } from "@/modules/api/graphql/queries/query-sales-workbench"

/** Workspace-scoped cache identity for the salesWorkbench query. */
export const QUERY_SALES_WORKBENCH_SWR_KEY = "QUERY_SALES_WORKBENCH_SWR"

/** How often the desk rereads: a decision the chain opens after a handover appears without a reload. */
const REFRESH_MS = 5000

/** Reads salesWorkbench. The workspace id is part of the cache identity; `undefined` pauses the read. */
export const useQuerySalesWorkbenchSwr = (workspaceId: string | undefined) =>
    useSWR(
        argumentKey(QUERY_SALES_WORKBENCH_SWR_KEY, workspaceId),
        async () => (await querySalesWorkbench()).data?.salesWorkbench ?? noData("salesWorkbench"),
        { refreshInterval: REFRESH_MS },
    )
