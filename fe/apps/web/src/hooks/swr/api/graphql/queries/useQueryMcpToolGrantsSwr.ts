"use client"

import useSWR from "swr"
import { queryMcpToolGrants } from "@/modules/api/graphql/queries/query-mcp-tool-grants"

/** The SWR key of the mcpToolGrants query. */
export const QUERY_MCP_TOOL_GRANTS_SWR_KEY = "QUERY_MCP_TOOL_GRANTS_SWR"

/** Every agent's grants of gateway tools (default deny); nothing is read while `enabled` is false (not a manager). */
export const useQueryMcpToolGrantsSwr = (enabled: boolean) =>
    useSWR(enabled ? QUERY_MCP_TOOL_GRANTS_SWR_KEY : null, async ({ signal }: { signal?: AbortSignal } = {}) => {
        const result = await queryMcpToolGrants({ signal })
        if (!result.data) throw new Error("mcpToolGrants answered no data")
        return result.data.mcpToolGrants
    })
