"use client"

import useSWR from "swr"
import { queryWorkspaceStaff } from "@/modules/api/graphql/queries/query-workspace-staff"

/** The SWR key of the workspaceStaff query; mutations that change it call `mutate` with it. */
export const QUERY_WORKSPACE_STAFF_SWR_KEY = "QUERY_WORKSPACE_STAFF_SWR"

/** The active staff rows of the active workspace. */
export const useQueryWorkspaceStaffSwr = (workspaceId: string | undefined) =>
    useSWR(workspaceId === undefined ? null : [QUERY_WORKSPACE_STAFF_SWR_KEY, workspaceId], async () => {
        const result = await queryWorkspaceStaff()
        if (!result.data) throw new Error("workspaceStaff answered no data")
        return result.data.workspaceStaff
    })
