"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { querySandboxWaitingRuns } from "@/modules/api/graphql/queries/query-sandbox-waiting-runs"
import { answeredData, type WorkspaceReadKey, type ReadResponse } from "@/hooks/workspaceread"
import type { SandboxWaitingRunsQuery } from "@/modules/api"

/** The SWR key of the sandboxWaitingRuns query. */
export const QUERY_SANDBOX_WAITING_RUNS_SWR_KEY = "QUERY_SANDBOX_WAITING_RUNS_SWR"

/** How often the read asks again, so what the agents did meanwhile shows without a reload (milliseconds). */
const REFRESH_MS = 8000

/** The runs of the workspace parked at a wait, newest first; `enabled` false waits. */
export const useQuerySandboxWaitingRunsSwr = (
    limit: number,
    enabled = true,
): ReadResponse<SandboxWaitingRunsQuery["sandboxWaitingRuns"]> =>
    useSWR(
        useWorkspaceKey(QUERY_SANDBOX_WAITING_RUNS_SWR_KEY, [String(limit)], enabled),
        async ([, , count]: WorkspaceReadKey<string>) =>
            answeredData(await querySandboxWaitingRuns({ request: { limit: Number(count) } }), "sandboxWaitingRuns")
                .sandboxWaitingRuns,
        { refreshInterval: REFRESH_MS },
    )
