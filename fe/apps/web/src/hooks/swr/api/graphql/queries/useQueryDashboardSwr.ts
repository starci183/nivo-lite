"use client"

import useSWR from "swr"
import { queryDashboard } from "@/modules/api/graphql/queries/query-dashboard"

/** The SWR key of the dashboard; mutations that change it call `mutate` on it. */
export const QUERY_DASHBOARD_SWR_KEY = "QUERY_DASHBOARD_SWR"

/** How often the overview reads the dashboard again. */
const DASHBOARD_REFRESH_MS = 60_000

/** Everything the overview shows about the workspace, read again every minute (the back end `dashboard` query). */
export const useQueryDashboardSwr = (workspaceId: string | undefined) =>
    useSWR(
        workspaceId === undefined ? null : [QUERY_DASHBOARD_SWR_KEY, workspaceId],
        async () => {
            const result = await queryDashboard()
            if (!result.data) throw new Error("dashboard answered no data")
            return result.data.dashboard
        },
        { refreshInterval: DASHBOARD_REFRESH_MS },
    )
