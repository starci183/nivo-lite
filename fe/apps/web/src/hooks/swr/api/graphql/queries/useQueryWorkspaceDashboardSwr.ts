"use client"

import { workspaceArgumentKey, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryWorkspaceDashboard } from "@/modules/api/graphql/queries/query-workspace-dashboard"
import type { WorkspaceDashboardQuery } from "@/modules/api"

/** The identity of the owner dashboard cache. */
const QUERY_WORKSPACE_DASHBOARD_SWR_KEY = "QUERY_WORKSPACE_DASHBOARD_SWR"

/** The periods the dashboard reads; each is its own cache entry so a switch back is instant. */
export type WorkspaceDashboardPeriod = "today" | "last_7_days" | "last_30_days" | "this_month"

/** Reads the owner dashboard of a workspace for a period and refreshes it every minute while the page is visible. */
export const useQueryWorkspaceDashboardSwr = (
    workspaceId: string | undefined,
    period: WorkspaceDashboardPeriod,
): ReadResponse<WorkspaceDashboardQuery["workspaceDashboard"]> =>
    useSWR(
        workspaceArgumentKey(QUERY_WORKSPACE_DASHBOARD_SWR_KEY, workspaceId, period),
        async ([, scope, asked]: WorkspaceReadKey<WorkspaceDashboardPeriod>) => {
            const result = await queryWorkspaceDashboard({
                request: { period: asked },
                headers: { "X-Workspace-Id": scope },
            })
            if (!result.data) throw new Error("workspaceDashboard answered no data")
            return result.data.workspaceDashboard
        },
        { refreshInterval: 60_000, keepPreviousData: true },
    )
