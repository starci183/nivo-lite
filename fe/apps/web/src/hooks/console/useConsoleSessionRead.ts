"use client"

import { useMemo } from "react"
import { useQueryMyAccountSwr, useQueryMyWorkspacesSwr } from "@/hooks/swr"
import { useOpenWorkspaceId } from "@/hooks/workspaceKey"
import type { ConsoleSessionView } from "@/modules/types"
import { sessionRoleOf } from "./console.shared"

/**
 * Reads the signed-in person's session in the workspace of the open address from SWR; none while it is unread and for a workspace the person is not an active member of.
 * Console bootstrap and the onboarding handover share this read; only console bootstrap applies its redirects.
 */
export const useConsoleSessionRead = (): ConsoleSessionView | undefined => {
    const memberships = useQueryMyWorkspacesSwr()
    const account = useQueryMyAccountSwr()
    const workspaceId = useOpenWorkspaceId()
    return useMemo(() => {
        if (memberships.data === undefined || account.data === undefined) return undefined
        const active = memberships.data.filter((entry) => entry.member.status === "active")
        const chosen = active.find((entry) => entry.workspace.id === workspaceId)
        if (chosen === undefined) return undefined
        return {
            member: {
                workspaceId: chosen.workspace.id,
                userId: chosen.member.userId,
                name: chosen.member.displayName,
                role: sessionRoleOf(chosen.member.role),
                staffId: chosen.member.staffId ?? null,
            },
            workspaceName: chosen.workspace.name,
            userName: chosen.member.displayName,
            email: account.data.email,
            avatarUrl: account.data.avatarUrl ?? undefined,
            workspaces: active.map((entry) => ({
                id: entry.workspace.id,
                name: entry.workspace.name,
                role: sessionRoleOf(entry.member.role),
            })),
            currentWorkspaceId: chosen.workspace.id,
        }
    }, [memberships.data, account.data, workspaceId])
}
