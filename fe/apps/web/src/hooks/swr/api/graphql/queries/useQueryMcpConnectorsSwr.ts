"use client"

import useSWR from "swr"
import { queryMcpConnectors } from "@/modules/api/graphql/queries/query-mcp-connectors"

/** The SWR key of the mcpConnectors query. */
export const QUERY_MCP_CONNECTORS_SWR_KEY = "QUERY_MCP_CONNECTORS_SWR"

/** Reads the connectors once; rejects when the back end answers no data. */
const readConnectors = async ({ signal }: { signal?: AbortSignal } = {}) => {
    const result = await queryMcpConnectors({ signal })
    if (!result.data) throw new Error("mcpConnectors answered no data")
    return result.data.mcpConnectors
}

/** The MCP gateway connectors of the workspace and their pinned tools; nothing is read while `enabled` is false (not a manager). */
export const useQueryMcpConnectorsSwr = (enabled: boolean) =>
    useSWR(enabled ? QUERY_MCP_CONNECTORS_SWR_KEY : null, readConnectors)
