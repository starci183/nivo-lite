"use client"

import useSWR from "swr"
import { queryMcpConnectors } from "@/modules/api/graphql/queries/query-mcp-connectors"

/** The SWR key of the mcpConnectors query. */
export const QUERY_MCP_CONNECTORS_SWR_KEY = "QUERY_MCP_CONNECTORS_SWR"

/** The MCP gateway connectors of the workspace and their namespaced tools. */
export const useQueryMcpConnectorsSwr = () =>
    useSWR(QUERY_MCP_CONNECTORS_SWR_KEY, async ({ signal }: { signal?: AbortSignal } = {}) => {
        const result = await queryMcpConnectors({ signal })
        if (!result.data) throw new Error("mcpConnectors answered no data")
        return result.data.mcpConnectors
    })
