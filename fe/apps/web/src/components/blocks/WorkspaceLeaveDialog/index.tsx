"use client"

import { useTranslations } from "next-intl"
import { useLobbyCommands, useLobbyWorkInHand, useLobbyWorkspaces } from "@/hooks/lobby"
import { useLobbyDialogStore } from "@/hooks/zustand/lobbyDialog"
import type { WorkspaceLeaveView } from "@/modules/types"
import { WorkspaceLeaveDialogBase } from "./component"

/** The catalog key (`workspacesLobby`) of each role. */
const ROLE_KEYS = { owner: "roleOwner", manager: "roleManager", staff: "roleStaff" } as const

/** The connected leave dialog: open while the lobby's dialog store names `leave`; leaving takes the seat out of the workspace. */
export const WorkspaceLeaveDialog = () => {
    const t = useTranslations("workspacesDialogs")
    const tLobby = useTranslations("workspacesLobby")
    const dialog = useLobbyDialogStore((state) => state.dialog)
    const close = useLobbyDialogStore((state) => state.close)
    const { rows } = useLobbyWorkspaces()
    const commands = useLobbyCommands()
    const row = dialog?.kind === "leave" ? rows.find((candidate) => candidate.id === dialog.workspaceId) : undefined
    const work = useLobbyWorkInHand(row?.state === "active" || row?.state === "new" ? row.id : undefined)
    if (row === undefined) return null
    const view: WorkspaceLeaveView = {
        workspaceName: row.name,
        role: tLobby(ROLE_KEYS[row.role]),
        workInHand: work === undefined ? null : tLobby("workInHand", { count: work }),
        isPending: commands.isLeaving,
    }
    const { workspaceName } = view
    return (
        <WorkspaceLeaveDialogBase
            props={{
                title: t("leaveTitle", { workspace: workspaceName }),
                description: t("leaveText", { workspace: workspaceName }),
                roleLabel: t("leaveRole"),
                workLabel: t("leaveWork"),
                reentryLabel: t("leaveReentry"),
                reentryValue: t("leaveReentryValue"),
                stayLabel: t("leaveStay"),
                leaveLabel: t("leaveConfirm"),
                view,
            }}
            on={{
                confirm: () => {
                    void commands.leave(row.id).then((done) => {
                        if (done) close()
                    })
                },
                close,
            }}
        />
    )
}
