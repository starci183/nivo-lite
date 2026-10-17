"use client"

import { argumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryWorkspaceMembers } from "@/modules/api/graphql/queries/query-workspace-members"

/** The SWR key of the workspaceMembers query; mutations that change it call `mutate` with it. */
export const QUERY_WORKSPACE_MEMBERS_SWR_KEY = "QUERY_WORKSPACE_MEMBERS_SWR"

/** Every member of the active workspace. */
export const useQueryWorkspaceMembersSwr = (workspaceId: string | undefined) =>
    useSWR(argumentKey(QUERY_WORKSPACE_MEMBERS_SWR_KEY, workspaceId), async () => {
        const result = await queryWorkspaceMembers()
        if (!result.data) throw new Error("workspaceMembers answered no data")
        return result.data.workspaceMembers
    })
