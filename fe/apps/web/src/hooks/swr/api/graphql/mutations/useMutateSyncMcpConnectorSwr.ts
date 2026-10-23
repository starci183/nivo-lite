"use client"

import useSWRMutation from "swr/mutation"
import { mutateSyncMcpConnector } from "@/modules/api/graphql/mutations/mutation-sync-mcp-connector"
import type { MutateSyncMcpConnectorRequest } from "@/modules/api/graphql/mutations/mutation-sync-mcp-connector"

/** What the SyncMcpConnector mutation is triggered with. */
interface SyncMcpConnectorArg {
    readonly arg: MutateSyncMcpConnectorRequest
}

/** The SWR key of {@link useMutateSyncMcpConnectorSwr}. */
export const MUTATE_SYNC_MCP_CONNECTOR_SWR_KEY = "MUTATE_SYNC_MCP_CONNECTOR_SWR"

/** SWR mutation for {@link mutateSyncMcpConnector}: `trigger(input)` reads the live tool list and answers the tool count; rejects with the back end failure. */
export const useMutateSyncMcpConnectorSwr = () =>
    useSWRMutation(MUTATE_SYNC_MCP_CONNECTOR_SWR_KEY, async (_key: string, { arg }: SyncMcpConnectorArg) => {
        const result = await mutateSyncMcpConnector({ request: arg })
        if (!result.data) throw new Error("syncMcpConnector answered no data")
        return result.data.syncMcpConnector
    })
