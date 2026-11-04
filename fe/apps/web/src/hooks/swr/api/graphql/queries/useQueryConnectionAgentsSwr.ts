"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryConnectionAgents } from "@/modules/api/graphql/queries/query-connection-agents"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import type { ConnectionAgentsQuery } from "@/modules/api"

/** The SWR key of the connectionAgents query. */
export const QUERY_CONNECTION_AGENTS_SWR_KEY = "QUERY_CONNECTION_AGENTS_SWR"

/** The agents of the workspace the connections console names. */
export const useQueryConnectionAgentsSwr = (): ReadResponse<ConnectionAgentsQuery["connectionAgents"]> =>
    useSWR(
        useWorkspaceKey(QUERY_CONNECTION_AGENTS_SWR_KEY, []),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryConnectionAgents({ signal }), "connectionAgents").connectionAgents,
    )
