import type { SWRConfiguration } from "swr"
import { jobPolling, noData, useWorkspaceArgSwr } from "@/hooks/workspaceread"
import { querySalesActionStatus } from "@/modules/api/graphql/queries/query-sales-action-status"

/** Workspace-scoped cache identity for the salesActionStatus query. */
export const QUERY_SALES_ACTION_STATUS_SWR_KEY = "QUERY_SALES_ACTION_STATUS_SWR"

/** Reads salesActionStatus and polls until the queued work reaches a terminal status. The workspace id is part of the cache identity; `undefined` pauses the read. */
export const useQuerySalesActionStatusSwr = (
    workspaceId: string | undefined,
    id: string | undefined,
    options?: SWRConfiguration,
) =>
    useWorkspaceArgSwr(
        QUERY_SALES_ACTION_STATUS_SWR_KEY,
        workspaceId,
        id,
        async (value) =>
            (await querySalesActionStatus({ request: { id: value } })).data?.salesActionStatus ??
            noData("salesActionStatus"),
        jobPolling(options),
    )
