"use client"

import { useMemo } from "react"
import { useQueryMyAccountSwr, useQueryMyWorkspacesSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { LocalStorage, StorageId } from "@/modules/storage"
import type { ConsoleSessionView } from "@/modules/types"
import { sessionRoleOf } from "./console.shared"

/**
 * Reads the signed-in person's workspace session from SWR, choosing the remembered workspace or the first active one.
 * Console bootstrap and the onboarding handover share this read; only console bootstrap applies its redirects.
 */
export const useConsoleSessionRead = (): ConsoleSessionView | undefined => {
    const memberships = useQueryMyWorkspacesSwr()
    const account = useQueryMyAccountSwr()
    const { activeWorkspaceId } = useActiveWorkspace()
    const wanted = activeWorkspaceId ?? LocalStorage.get<string>(StorageId.ActiveWorkspaceId)
    return useMemo(() => {
        if (memberships.data === undefined || account.data === undefined) return undefined
        const active = memberships.data.filter((entry) => entry.member.status === "active")
        const chosen = active.find((entry) => entry.workspace.id === wanted) ?? active[0]
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
    }, [memberships.data, account.data, wanted])
}
