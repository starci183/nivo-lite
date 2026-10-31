"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryWorkspaceAgentWork } from "@/modules/api/graphql/queries/query-workspace-agent-work"

/** The SWR key of {@link useQueryWorkspaceAgentWorkSwr}. */
export const QUERY_WORKSPACE_AGENT_WORK_SWR_KEY = "QUERY_WORKSPACE_AGENT_WORK_SWR"

/** The back end `workspaceAgentWork` query of the active workspace. */
export const useQueryWorkspaceAgentWorkSwr = (config?: SWRConfiguration) =>
    useSWR(
        useWorkspaceKey(QUERY_WORKSPACE_AGENT_WORK_SWR_KEY, []),
        async ({ signal }: { signal?: AbortSignal } = {}) => {
            const result = await queryWorkspaceAgentWork({ signal })
            if (!result.data) throw new Error("workspaceAgentWork answered no data")
            return result.data.workspaceAgentWork
        },
        config,
    )
