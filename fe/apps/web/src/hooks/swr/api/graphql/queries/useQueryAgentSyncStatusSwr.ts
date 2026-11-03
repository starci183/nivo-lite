"use client"

import { answeredData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAgentSyncStatus } from "@/modules/api/graphql/queries/query-agent-sync-status"
import type { QueryAgentSyncStatusRequest } from "@/modules/api/graphql/queries/query-agent-sync-status"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of {@link useQueryAgentSyncStatusSwr}. */
export const QUERY_AGENT_SYNC_STATUS_SWR_KEY = "QUERY_AGENT_SYNC_STATUS_SWR"

/** The back end `agentSyncStatus` query. Pass `null` to wait for the arguments. */
export const useQueryAgentSyncStatusSwr = (
    request: QueryAgentSyncStatusRequest | null,
    config?: SWRConfiguration,
): ReadResponse<OperationData<typeof queryAgentSyncStatus>["agentSyncStatus"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_SYNC_STATUS_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentSyncStatusRequest>) =>
            answeredData(await queryAgentSyncStatus({ request: input }), QUERY_AGENT_SYNC_STATUS_SWR_KEY)
                .agentSyncStatus,
        config,
    )
