"use client"

import {
    jobPolling,
    noData,
    workspaceArgumentKey,
    type ReadResponse,
    type WorkspaceReadKey,
} from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { querySalesActionStatus } from "@/modules/api/graphql/queries/query-sales-action-status"
import type { SalesActionStatusQuery } from "@/modules/api"

/** Workspace-scoped cache identity for the salesActionStatus query. */
export const QUERY_SALES_ACTION_STATUS_SWR_KEY = "QUERY_SALES_ACTION_STATUS_SWR"

/** Reads salesActionStatus and polls until the queued work reaches a terminal status. The workspace id is part of the cache identity; `undefined` pauses the read. */
export const useQuerySalesActionStatusSwr = (
    workspaceId: string | undefined,
    id: string | undefined,
    options?: SWRConfiguration,
): ReadResponse<NonNullable<SalesActionStatusQuery["salesActionStatus"]>> =>
    useSWR(
        workspaceArgumentKey(QUERY_SALES_ACTION_STATUS_SWR_KEY, workspaceId, id),
        async ([, , input]: WorkspaceReadKey<string>) =>
            (await querySalesActionStatus({ request: { id: input } })).data?.salesActionStatus ??
            noData("salesActionStatus"),
        jobPolling(options),
    )
