"use client"

import { useCallback } from "react"
import { useSWRConfig } from "swr"
import { connectionCacheKey } from "@/hooks/connectionPages"
import {
    QUERY_AGENT_DASHBOARD_SWR_KEY,
    QUERY_LEAD_BOARD_SWR_KEY,
    QUERY_LEAD_DIRECTORY_SWR_KEY,
    QUERY_LEAD_FLOW_SWR_KEY,
    QUERY_LEAD_GEN_WORKBENCH_SWR_KEY,
    QUERY_LEAD_JOURNEY_SWR_KEY,
} from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"

const LEAD_VIEW_KEYS: ReadonlySet<string> = new Set([
    QUERY_LEAD_JOURNEY_SWR_KEY,
    QUERY_LEAD_FLOW_SWR_KEY,
    QUERY_LEAD_GEN_WORKBENCH_SWR_KEY,
    QUERY_AGENT_DASHBOARD_SWR_KEY,
])

/** Reads again every lead-derived view of the active workspace (board, journey, flow, workbenches, dashboards) after a write. */
export const useRevalidateLeadViews = (): (() => Promise<unknown[]>) => {
    const { mutate } = useSWRConfig()
    const workspaceId = useWorkspaceId()
    return useCallback(() => {
        return Promise.all([
            mutate((key) => Array.isArray(key) && key[1] === workspaceId && LEAD_VIEW_KEYS.has(String(key[0]))),
            mutate(connectionCacheKey(QUERY_LEAD_BOARD_SWR_KEY, workspaceId)),
            mutate(connectionCacheKey(QUERY_LEAD_DIRECTORY_SWR_KEY, workspaceId)),
        ])
    }, [workspaceId, mutate])
}
