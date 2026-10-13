import type { SWRConfiguration } from "swr"
import { useGraphqlQuerySwr } from "@/hooks/reuseables"
import { queryAgentSyncStatus } from "@/modules/api/graphql/queries/query-agent-sync-status"
import type { QueryAgentSyncStatusRequest } from "@/modules/api/graphql/queries/query-agent-sync-status"

/** The SWR key of {@link useQueryAgentSyncStatusSwr}. */
export const QUERY_AGENT_SYNC_STATUS_SWR_KEY = "QUERY_AGENT_SYNC_STATUS_SWR"

/** The back end `agentSyncStatus` query. Pass `null` to wait for the arguments. */
export const useQueryAgentSyncStatusSwr = (request: QueryAgentSyncStatusRequest | null, config?: SWRConfiguration) =>
    useGraphqlQuerySwr(
        QUERY_AGENT_SYNC_STATUS_SWR_KEY,
        request,
        (input) => queryAgentSyncStatus({ request: input }),
        (data) => data.agentSyncStatus,
        config,
    )
