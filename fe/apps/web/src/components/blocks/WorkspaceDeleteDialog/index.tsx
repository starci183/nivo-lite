"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useLobbyCommands, useLobbyWorkspaces } from "@/hooks/lobby"
import { useLobbyDialogStore } from "@/hooks/zustand/lobbyDialog"
import type { WorkspaceDeleteView } from "@/modules/types"
import { WorkspaceDeleteDialogBase } from "./component"

/** How many days the owner has to restore a deleted workspace (the back end's window). */
const RESTORE_DAYS = 30

/**
 * The connected delete dialog: open while the lobby's dialog store names `delete`. A soft delete: the agents pause, the connections take
 * in no event, every member loses access, and the owner may restore it all within 30 days.
 */
export const WorkspaceDeleteDialog = () => {
    const t = useTranslations("workspacesDialogs")
    const tLobby = useTranslations("workspacesLobby")
    const dialog = useLobbyDialogStore((state) => state.dialog)
    const close = useLobbyDialogStore((state) => state.close)
    const { rows } = useLobbyWorkspaces()
    const commands = useLobbyCommands()
    const [typed, setTyped] = useState("")
    const row = dialog?.kind === "delete" ? rows.find((candidate) => candidate.id === dialog.workspaceId) : undefined
    if (row === undefined) return null
    const view: WorkspaceDeleteView = {
        workspaceName: row.name,
        impact: [
            { label: tLobby("impactAgents"), value: tLobby("impactAgentsValue") },
            { label: tLobby("impactConnections"), value: tLobby("impactConnectionsValue") },
            { label: tLobby("impactMembers"), value: tLobby("impactMembersValue", { count: row.memberCount }) },
        ],
        restoreDays: RESTORE_DAYS,
        typed,
        canConfirm: typed.trim() === row.name.trim(),
        isPending: commands.isDeleting,
    }
    const { workspaceName, restoreDays } = view
    const dismiss = () => {
        setTyped("")
        close()
    }
    return (
        <WorkspaceDeleteDialogBase
            props={{
                title: t("deleteTitle", { workspace: workspaceName }),
                description: t("deleteText", { workspace: workspaceName }),
                restoreText: restoreDays === null ? "" : t("deleteRestore", { days: restoreDays }),
                fieldLabel: t("deleteField", { workspace: workspaceName }),
                cancelLabel: t("deleteCancel"),
                confirmLabel: t("deleteConfirm"),
                view,
            }}
            on={{
                change: setTyped,
                confirm: () => {
                    void commands.remove(row.id, typed).then((done) => {
                        if (done) dismiss()
                    })
                },
                close: dismiss,
            }}
        />
    )
}
