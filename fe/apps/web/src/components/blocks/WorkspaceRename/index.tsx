"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useLobbyCommands, useLobbyWorkspaces } from "@/hooks/lobby"
import { useLobbyDialogStore } from "@/hooks/zustand/lobbyDialog"
import { WorkspaceRenameBase } from "./component"

/** The shortest and longest name the rename accepts. */
const NAME_MIN = 3
const NAME_MAX = 60

/** Why a typed name cannot be saved, as a catalog key (`workspacesMenu`); none when it can. */
const lengthErrorOf = (value: string): "renameTooShort" | "renameTooLong" | undefined => {
    const length = value.trim().length
    if (length < NAME_MIN) return "renameTooShort"
    return length > NAME_MAX ? "renameTooLong" : undefined
}

/** The connected rename step: open while the lobby's dialog store names `rename`; saving renames the workspace. */
export const WorkspaceRename = () => {
    const t = useTranslations("workspacesMenu")
    const dialog = useLobbyDialogStore((state) => state.dialog)
    const close = useLobbyDialogStore((state) => state.close)
    const { rows } = useLobbyWorkspaces()
    const commands = useLobbyCommands()
    const [typed, setTyped] = useState<string | undefined>(undefined)
    const row = dialog?.kind === "rename" ? rows.find((candidate) => candidate.id === dialog.workspaceId) : undefined
    if (row === undefined) return null
    const value = typed ?? row.name
    const error = lengthErrorOf(value)
    const dismiss = () => {
        setTyped(undefined)
        close()
    }
    return (
        <WorkspaceRenameBase
            props={{
                name: row.name,
                title: t("renameTitle"),
                description: t("renameDescription"),
                fieldLabel: t("renameField"),
                hint: t("renameHint"),
                cancelLabel: t("renameCancel"),
                saveLabel: t("renameSave"),
                value,
                error: error === undefined ? undefined : t(error),
                isPending: commands.isRenaming,
            }}
            on={{
                change: setTyped,
                submit: () => {
                    if (error !== undefined) return
                    void commands.rename(row.id, value).then((done) => {
                        if (done) dismiss()
                    })
                },
                close: dismiss,
            }}
        />
    )
}
