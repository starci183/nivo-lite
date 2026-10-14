"use client"

import useSWR from "swr"
import { queryWorkspaceInvites } from "@/modules/api/graphql/queries/query-workspace-invites"

/** The SWR key of the workspaceInvites query; mutations that change it call `mutate` with it. */
export const QUERY_WORKSPACE_INVITES_SWR_KEY = "QUERY_WORKSPACE_INVITES_SWR"

/** The open invitations of the active workspace. */
export const useQueryWorkspaceInvitesSwr = (workspaceId: string | undefined) =>
    useSWR(workspaceId === undefined ? null : [QUERY_WORKSPACE_INVITES_SWR_KEY, workspaceId], async () => {
        const result = await queryWorkspaceInvites()
        if (!result.data) throw new Error("workspaceInvites answered no data")
        return result.data.workspaceInvites
    })
