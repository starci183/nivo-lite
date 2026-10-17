"use client"

import { answeredData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryWorkItems } from "@/modules/api/graphql/queries/query-work-items"
import type { QueryWorkItemsRequest } from "@/modules/api/graphql/queries/query-work-items"

/** The SWR key of {@link useQueryWorkItemsSwr}. */
export const QUERY_WORK_ITEMS_SWR_KEY = "QUERY_WORK_ITEMS_SWR"

/** The back end `workItems` query. Pass `null` to wait for the arguments. */
export const useQueryWorkItemsSwr = (request: QueryWorkItemsRequest | null, config?: SWRConfiguration) =>
    useSWR(
        useWorkspaceRequestKey(QUERY_WORK_ITEMS_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryWorkItemsRequest>) =>
            answeredData(await queryWorkItems({ request: input }), QUERY_WORK_ITEMS_SWR_KEY).workItems,
        config,
    )
