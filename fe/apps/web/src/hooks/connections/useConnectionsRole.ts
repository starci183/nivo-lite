"use client"

import { useActiveWorkspace, useWorkspaceCards } from "@/hooks/workspaces"

/** The viewer's role in the active workspace, and whether the workspaces are still being read. */
export const useConnectionsRole = () => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const workspaces = useWorkspaceCards()
    const role = workspaces.cards.find((card) => card.id === activeWorkspaceId)?.role
    return { role, isLoading: workspaces.status === "loading" }
}
