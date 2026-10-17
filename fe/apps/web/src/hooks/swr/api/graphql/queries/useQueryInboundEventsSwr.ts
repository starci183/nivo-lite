"use client"

import { workspaceArgumentKey } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryInboundEvents } from "@/modules/api/graphql/queries/query-inbound-events"

/** The identity of the inbox feed cache. */
export const QUERY_INBOUND_EVENTS_SWR_KEY = "QUERY_INBOUND_EVENTS_SWR"

/** Refreshes the workspace's inbox while visible, including inputs received from other channels. */
export const useQueryInboundEventsSwr = (workspaceId: string | undefined, limit = 40) =>
    useSWR(
        workspaceArgumentKey(QUERY_INBOUND_EVENTS_SWR_KEY, workspaceId, limit),
        async ([, scope, feedLimit]: WorkspaceReadKey<number>) => {
            const result = await queryInboundEvents({
                request: { limit: feedLimit },
                headers: { "X-Workspace-Id": scope },
            })
            if (!result.data) throw new Error("inboundEvents answered no data")
            return result.data.inboundEvents
        },
        { refreshInterval: 5000 },
    )
