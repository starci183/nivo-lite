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
    QUERY_LEAD_WAIT_SWR_KEY,
    QUERY_PROMO_CHATBOT_STATE_SWR_KEY,
    QUERY_SALES_WORKBENCH_SWR_KEY,
    QUERY_SALES_ORDERS_SWR_KEY,
} from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"

const LEAD_VIEW_KEYS: ReadonlySet<string> = new Set([
    QUERY_LEAD_JOURNEY_SWR_KEY,
    QUERY_LEAD_FLOW_SWR_KEY,
    QUERY_LEAD_WAIT_SWR_KEY,
    QUERY_LEAD_GEN_WORKBENCH_SWR_KEY,
    QUERY_PROMO_CHATBOT_STATE_SWR_KEY,
    QUERY_AGENT_DASHBOARD_SWR_KEY,
    QUERY_SALES_WORKBENCH_SWR_KEY,
])

/** Reads again every lead-derived view of the active workspace (board, journey, flow, workbenches, dashboards) after a write. */
export const useRevalidateLeadViews = () => {
    const { mutate } = useSWRConfig()
    const { activeWorkspaceId } = useActiveWorkspace()
    return useCallback(() => {
        if (activeWorkspaceId === undefined) return Promise.resolve([])
        return Promise.all([
            mutate((key) => Array.isArray(key) && key[1] === activeWorkspaceId && LEAD_VIEW_KEYS.has(String(key[0]))),
            mutate(connectionCacheKey(QUERY_LEAD_BOARD_SWR_KEY, activeWorkspaceId)),
            mutate(connectionCacheKey(QUERY_LEAD_DIRECTORY_SWR_KEY, activeWorkspaceId)),
            mutate(connectionCacheKey(QUERY_SALES_ORDERS_SWR_KEY, activeWorkspaceId)),
        ])
    }, [activeWorkspaceId, mutate])
}
