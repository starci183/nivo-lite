"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import {
    QUERY_MY_WORKSPACES_SWR_KEY,
    useMutateDeleteWorkspaceSwr,
    useMutateLeaveWorkspaceSwr,
    useMutateLobbyInviteLinkSwr,
    useMutateRenameWorkspaceSwr,
    useMutateRestoreWorkspaceSwr,
} from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { matchesSwrKey } from "@/modules/utils"
import { mutate } from "@/modules/viewer-cache"
import { daysUntil, type LobbyWorkspace } from "./lobby.shared"

/** The lobby's commands on one workspace. Each toasts its outcome (a failure with the back end words) and answers whether it worked. */
export interface LobbyCommands {
    readonly rename: (workspaceId: string, name: string) => Promise<boolean>
    readonly leave: (workspaceId: string) => Promise<boolean>
    readonly remove: (workspaceId: string, confirmName: string) => Promise<boolean>
    /** Copies a fresh link to the workspace's newest pending invitation; with none pending it says so. */
    readonly copyLink: (workspace: LobbyWorkspace) => Promise<boolean>
    /** Restores a workspace its owner deleted, within its restore window. */
    readonly restore: (workspace: LobbyWorkspace) => Promise<boolean>
    readonly isRenaming: boolean
    readonly isLeaving: boolean
    readonly isDeleting: boolean
    readonly isCopying: boolean
    readonly isRestoring: boolean
}

/** Reads the person's workspaces again after a change. */
const refreshLobby = async (): Promise<void> => {
    await mutate(matchesSwrKey(QUERY_MY_WORKSPACES_SWR_KEY))
}

/** Rename, leave, delete and copy an invitation link from the workspaces lobby, through the back end, toasted. */
export const useLobbyCommands = (): LobbyCommands => {
    const t = useTranslations("workspacesLobby")
    const tMenu = useTranslations("workspacesMenu")
    const runGraphQL = useGraphQLWithToast()
    const renaming = useMutateRenameWorkspaceSwr()
    const leaving = useMutateLeaveWorkspaceSwr()
    const deleting = useMutateDeleteWorkspaceSwr()
    const linking = useMutateLobbyInviteLinkSwr()
    const restoring = useMutateRestoreWorkspaceSwr()
    const rename = useCallback(
        async (workspaceId: string, name: string): Promise<boolean> => {
            const done = await runGraphQL(() => renaming.trigger({ workspaceId, request: { name: name.trim() } }), {
                successMessage: t("renamed"),
            })
            if (done === undefined) return false
            await refreshLobby()
            return true
        },
        [runGraphQL, renaming, t],
    )
    const leave = useCallback(
        async (workspaceId: string): Promise<boolean> => {
            const done = await runGraphQL(() => leaving.trigger({ workspaceId }), { successMessage: t("left") })
            if (done === undefined) return false
            await refreshLobby()
            return true
        },
        [runGraphQL, leaving, t],
    )
    const remove = useCallback(
        async (workspaceId: string, confirmName: string): Promise<boolean> => {
            const done = await runGraphQL(() => deleting.trigger({ workspaceId, request: { confirmName } }), {
                successMessage: t("deleted"),
            })
            if (done === undefined) return false
            await refreshLobby()
            return true
        },
        [runGraphQL, deleting, t],
    )
    const copyLink = useCallback(
        async (workspace: LobbyWorkspace): Promise<boolean> => {
            const copied = await runGraphQL(() => linking.trigger({ workspaceId: workspace.id }), {
                showSuccessToast: false,
            })
            if (copied === undefined) return false
            if (copied === null) {
                toast.info(t("noPendingInvite", { name: workspace.name }))
                return false
            }
            try {
                await navigator.clipboard.writeText(copied.link)
            } catch {
                toast.danger(t("clipboardBlocked"), { description: copied.link })
                return false
            }
            toast.success(tMenu("copied", { name: workspace.name, days: daysUntil(copied.expiresAt, Date.now()) }))
            return true
        },
        [runGraphQL, linking, t, tMenu],
    )
    const restore = useCallback(
        async (workspace: LobbyWorkspace): Promise<boolean> => {
            const done = await runGraphQL(() => restoring.trigger({ workspaceId: workspace.id }), {
                successMessage: t("restored", { name: workspace.name }),
            })
            if (done === undefined) return false
            await refreshLobby()
            return true
        },
        [runGraphQL, restoring, t],
    )
    return {
        rename,
        restore,
        leave,
        remove,
        copyLink,
        isRenaming: renaming.isMutating,
        isLeaving: leaving.isMutating,
        isDeleting: deleting.isMutating,
        isCopying: linking.isMutating,
        isRestoring: restoring.isMutating,
    }
}
