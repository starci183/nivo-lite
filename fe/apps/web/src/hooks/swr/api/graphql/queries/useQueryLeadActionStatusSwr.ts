"use client"

import { workspaceArgumentKey, jobPolling, noData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryLeadActionStatus } from "@/modules/api/graphql/queries/query-lead-action-status"

/** Workspace-scoped cache identity for the leadActionStatus query. */
export const QUERY_LEAD_ACTION_STATUS_SWR_KEY = "QUERY_LEAD_ACTION_STATUS_SWR"

/** Reads leadActionStatus and polls until the queued work reaches a terminal status. The workspace id is part of the cache identity; `undefined` pauses the read. */
export const useQueryLeadActionStatusSwr = (
    workspaceId: string | undefined,
    id: string | undefined,
    options?: SWRConfiguration,
) =>
    useSWR(
        workspaceArgumentKey(QUERY_LEAD_ACTION_STATUS_SWR_KEY, workspaceId, id),
        async ([, , input]: WorkspaceReadKey<string>) =>
            (await queryLeadActionStatus({ request: { id: input } })).data?.leadActionStatus ??
            noData("leadActionStatus"),
        jobPolling(options),
    )
