"use client"

import { useCallback } from "react"
import { useQueryDashboardSwr } from "@/hooks/swr/api/graphql/queries/useQueryDashboardSwr"
import { useQueryMyWorkspacesSwr } from "@/hooks/swr/api/graphql/queries/useQueryMyWorkspacesSwr"
import { useActiveWorkspace } from "@/hooks/workspaces"

/**
 * The dashboard of the active workspace and the signed-in person's name in it, read through the shared SWR cache: every region of
 * the overview calls this and they all share one request. `dashboard` is undefined until the first answer.
 */
export const useOverviewData = () => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const query = useQueryDashboardSwr(activeWorkspaceId)
    const workspaces = useQueryMyWorkspacesSwr()
    const { mutate } = query
    const retry = useCallback(() => void mutate(), [mutate])
    return {
        dashboard: query.data,
        failed: query.data === undefined && query.error !== undefined,
        retry,
        displayName: workspaces.data?.find((entry) => entry.workspace.id === activeWorkspaceId)?.member.displayName,
    }
}
