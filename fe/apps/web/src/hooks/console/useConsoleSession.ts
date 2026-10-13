"use client"

import { useMemo } from "react"
import { useQueryMyAccountSwr, useQueryMyWorkspacesSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { LocalStorage, StorageId } from "@/modules/storage"
import type { ConsoleSession } from "@/modules/types"
import { sessionRoleOf } from "./console.shared"

/**
 * The signed-in person's console session, read from the back end (`myWorkspaces`, `myAccount`): the workspace picked last (else
 * the first active one) with the person's membership in it. `undefined` while loading or without an active membership.
 */
export const useConsoleSession = (): ConsoleSession | undefined => {
    const memberships = useQueryMyWorkspacesSwr()
    const account = useQueryMyAccountSwr()
    const { activeWorkspaceId } = useActiveWorkspace()
    const wanted = activeWorkspaceId ?? LocalStorage.get<string>(StorageId.ActiveWorkspaceId)
    return useMemo(() => {
        const active = (memberships.data ?? []).filter((entry) => entry.member.status === "active")
        const chosen = active.find((entry) => entry.workspace.id === wanted) ?? active[0]
        if (chosen === undefined || account.data === undefined) return undefined
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
            workspaces: active.map((entry) => ({
                id: entry.workspace.id,
                name: entry.workspace.name,
                role: sessionRoleOf(entry.member.role),
            })),
            currentWorkspaceId: chosen.workspace.id,
        }
    }, [memberships.data, account.data, wanted])
}
