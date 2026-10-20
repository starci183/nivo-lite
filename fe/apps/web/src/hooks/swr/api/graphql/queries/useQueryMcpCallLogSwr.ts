"use client"

import useSWR from "swr"
import { queryMcpCallLog } from "@/modules/api/graphql/queries/query-mcp-call-log"

/** The SWR key of the mcpCallLog query. */
export const QUERY_MCP_CALL_LOG_SWR_KEY = "QUERY_MCP_CALL_LOG_SWR"

/** The latest audited gateway calls, secrets masked. */
export const useQueryMcpCallLogSwr = (limit: number) =>
    useSWR([QUERY_MCP_CALL_LOG_SWR_KEY, limit], async ({ signal }: { signal?: AbortSignal } = {}) => {
        const result = await queryMcpCallLog({ signal, request: { input: { limit } } })
        if (!result.data) throw new Error("mcpCallLog answered no data")
        return result.data.mcpCallLog
    })
