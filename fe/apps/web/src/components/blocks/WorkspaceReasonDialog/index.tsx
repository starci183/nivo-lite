"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useLobbyCommands, useLobbyWorkspaces } from "@/hooks/lobby"
import { useLobbyDialogStore } from "@/hooks/zustand/lobbyDialog"
import type { WorkspaceReasonView } from "@/modules/types"
import { WorkspaceReasonDialogBase } from "./component"

/** The catalog key (`workspacesLobby`) of each role. */
const ROLE_KEYS = { owner: "roleOwner", manager: "roleManager", staff: "roleStaff" } as const

/** A day and a time, as the reason row shows when the seat was switched off. */
const AT_FORMAT = { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" } as const

/** Who switched the seat off, with their role when known; none when the back end did not record them. */
const byOf = (name: string | null, role: string | null): string | null => {
    if (name === null) return null
    return role === null ? name : `${name} · ${role}`
}

/**
 * The connected reason dialog: open while the lobby's dialog store names `reason`. It shows who switched the seat off, when, and the note,
 * as far as the back end recorded them; "message them" stays hidden (there is no channel for it) and "remove from the list" leaves.
 */
export const WorkspaceReasonDialog = () => {
    const t = useTranslations("workspacesInvites")
    const tLobby = useTranslations("workspacesLobby")
    const format = useFormatter()
    const dialog = useLobbyDialogStore((state) => state.dialog)
    const close = useLobbyDialogStore((state) => state.close)
    const { rows } = useLobbyWorkspaces()
    const commands = useLobbyCommands()
    const row = dialog?.kind === "reason" ? rows.find((candidate) => candidate.id === dialog.workspaceId) : undefined
    if (row === undefined) return null
    const { switchOff } = row
    const view: WorkspaceReasonView = {
        workspaceName: row.name,
        by: byOf(switchOff.byName, switchOff.byRole === null ? null : tLobby(ROLE_KEYS[switchOff.byRole])),
        at: switchOff.at === null ? null : format.dateTime(new Date(switchOff.at), AT_FORMAT),
        note: switchOff.note,
        contactName: null,
    }
    return (
        <WorkspaceReasonDialogBase
            props={{
                title: t("reasonTitle"),
                description: t("reasonText", { workspace: view.workspaceName }),
                byLabel: t("reasonBy"),
                atLabel: t("reasonAt"),
                noteLabel: t("reasonNote"),
                closeLabel: t("reasonClose"),
                hideLabel: t("reasonHide"),
                messageLabel: t("reasonMessage", { name: "" }),
                view,
            }}
            on={{
                hide: () => {
                    void commands.leave(row.id).then((done) => {
                        if (done) close()
                    })
                },
                message: close,
                close,
            }}
        />
    )
}
