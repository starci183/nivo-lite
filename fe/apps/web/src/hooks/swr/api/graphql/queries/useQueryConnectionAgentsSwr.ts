"use client"

import useSWR from "swr"
import { queryConnectionAgents } from "@/modules/api/graphql/queries/query-connection-agents"

/** The SWR key of the connectionAgents query. */
export const QUERY_CONNECTION_AGENTS_SWR_KEY = "QUERY_CONNECTION_AGENTS_SWR"

/** The agents of the workspace the connections console names. */
export const useQueryConnectionAgentsSwr = () =>
    useSWR(QUERY_CONNECTION_AGENTS_SWR_KEY, async ({ signal }: { signal?: AbortSignal } = {}) => {
        const result = await queryConnectionAgents({ signal })
        if (!result.data) throw new Error("connectionAgents answered no data")
        return result.data.connectionAgents
    })
