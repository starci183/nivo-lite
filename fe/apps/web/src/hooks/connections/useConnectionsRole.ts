"use client"

import { useWorkspaceCards } from "@/hooks/workspaces"
import { useOpenWorkspaceId } from "@/hooks/workspaceKey"

/** The view `useConnectionsRole` returns. */
export interface ConnectionsRoleView {
    read: ReturnType<typeof useWorkspaceCards>["read"]
    retry: () => void
    role: "owner" | "manager" | "staff" | undefined
    isLoading: boolean
}

/** The viewer's role in the active workspace, and whether the workspaces are still being read. */
export const useConnectionsRole = (): ConnectionsRoleView => {
    const workspaceId = useOpenWorkspaceId()
    const workspaces = useWorkspaceCards()
    const role = workspaces.cards.find((card) => card.id === workspaceId)?.role
    return { read: workspaces.read, retry: workspaces.reload, role, isLoading: workspaces.status === "loading" }
}
