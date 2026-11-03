"use client"

import { useActiveWorkspace, useWorkspaceCards } from "@/hooks/workspaces"
import type { SWRResponse } from "swr"

/** The view `useConnectionsRole` returns. */
export interface ConnectionsRoleView {
    read: SWRResponse<
        {
            workspace: {
                id: string
                name: string
                status: string
                ownerId: string
                createdAt: string
                businessType: string | null
            }
            member: {
                userId: string
                workspaceId: string
                role: string
                staffId: string | null
                displayName: string
                status: string
            }
        }[],
        Error
    >
    retry: () => void
    role: "owner" | "manager" | "staff" | undefined
    isLoading: boolean
}

/** The viewer's role in the active workspace, and whether the workspaces are still being read. */
export const useConnectionsRole = (): ConnectionsRoleView => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const workspaces = useWorkspaceCards()
    const role = workspaces.cards.find((card) => card.id === activeWorkspaceId)?.role
    return { read: workspaces.read, retry: workspaces.reload, role, isLoading: workspaces.status === "loading" }
}
