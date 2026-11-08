"use client"

import useSWR, { type SWRResponse } from "swr"
import {
    queryWorkspaceShell,
    type QueryWorkspaceShellRequest,
} from "@/modules/api/graphql/queries/query-workspace-shell"
import type { WorkspaceShellQuery } from "@/modules/api"

/** The SWR key of the workspaceShell query; mutations that change it call `mutate` with it. */
export const QUERY_WORKSPACE_SHELL_SWR_KEY = "QUERY_WORKSPACE_SHELL_SWR"

/** Everything the console frame draws, in one read. */
export const useQueryWorkspaceShellSwr = (
    workspaceId: string | undefined,
    request: QueryWorkspaceShellRequest,
): SWRResponse<WorkspaceShellQuery["workspaceShell"], Error> =>
    useSWR(
        workspaceId === undefined
            ? null
            : [QUERY_WORKSPACE_SHELL_SWR_KEY, workspaceId, request.foundingFrom, request.foundingTo],
        async () => {
            const result = await queryWorkspaceShell({ request })
            if (!result.data) throw new Error("workspaceShell answered no data")
            return result.data.workspaceShell
        },
    )
