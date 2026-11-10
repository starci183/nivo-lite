"use client"

import { useTranslations } from "next-intl"
import { lobbyTeamHref, useLobbyWorkspaces } from "@/hooks/lobby"
import { useLobbyDialogStore } from "@/hooks/zustand/lobbyDialog"
import { navigation } from "@/modules/i18n"
import { WorkspaceLeaveOwnerDialogBase } from "./component"

/** The connected last-owner dialog: open while the lobby's dialog store names `leaveOwner`; it leads to the team page or the deletion. */
export const WorkspaceLeaveOwnerDialog = () => {
    const t = useTranslations("workspacesDialogs")
    const router = navigation.useRouter()
    const dialog = useLobbyDialogStore((state) => state.dialog)
    const openDialog = useLobbyDialogStore((state) => state.open)
    const close = useLobbyDialogStore((state) => state.close)
    const { rows } = useLobbyWorkspaces()
    const row =
        dialog?.kind === "leaveOwner" ? rows.find((candidate) => candidate.id === dialog.workspaceId) : undefined
    if (row === undefined) return null
    const workspaceName = row.name
    return (
        <WorkspaceLeaveOwnerDialogBase
            props={{
                title: t("ownerTitle", { workspace: workspaceName }),
                description: t("ownerText", { workspace: workspaceName }),
                transferTitle: t("ownerTransferTitle"),
                transferText: t("ownerTransferText"),
                transferLabel: t("ownerTransferAction"),
                deleteTitle: t("ownerDeleteTitle"),
                deleteText: t("ownerDeleteText"),
                deleteLabel: t("ownerDeleteAction"),
                closeLabel: t("ownerClose"),
            }}
            on={{
                openTeam: () => {
                    close()
                    router.push(lobbyTeamHref(row.id))
                },
                startDelete: () => openDialog("delete", row.id),
                close,
            }}
        />
    )
}
