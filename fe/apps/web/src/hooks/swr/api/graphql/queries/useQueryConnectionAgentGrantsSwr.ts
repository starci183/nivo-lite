"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryConnectionAgentGrants } from "@/modules/api/graphql/queries/query-connection-agent-grants"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import type { ConnectionAgentGrantsQuery } from "@/modules/api"

/** The SWR key of the connectionAgentGrants query. */
export const QUERY_CONNECTION_AGENT_GRANTS_SWR_KEY = "QUERY_CONNECTION_AGENT_GRANTS_SWR"

/** Which agents are granted each connection of the workspace, for the reverse view on a provider page. */
export const useQueryConnectionAgentGrantsSwr = (): ReadResponse<ConnectionAgentGrantsQuery["connectionAgentGrants"]> =>
    useSWR(
        useWorkspaceKey(QUERY_CONNECTION_AGENT_GRANTS_SWR_KEY, []),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryConnectionAgentGrants({ signal }), "connectionAgentGrants").connectionAgentGrants,
    )
