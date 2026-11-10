"use client"

import { useTranslations } from "next-intl"
import { LOBBY_PLACEHOLDER, useLobbyView, useLobbyWide } from "@/hooks/lobby"
import { useSlotLabels } from "@/hooks/slot"
import type { WorkspacesTableCopy } from "@/modules/types"
import { WorkspacesTableBase } from "./component"

/** The connected workspaces table of a wide screen: the person's workspaces from the lobby read, each with its action and ⋯ menu. */
export const WorkspacesTable = () => {
    const t = useTranslations("workspacesTable")
    const slotLabels = useSlotLabels()
    const lobby = useLobbyView()
    const isWide = useLobbyWide()
    const copy: WorkspacesTableCopy = {
        title: t("title"),
        tableLabel: t("tableLabel"),
        columns: {
            workspace: t("columnWorkspace"),
            status: t("columnStatus"),
            lastOpened: t("columnLastOpened"),
            action: t("columnAction"),
            more: t("columnMore"),
        },
        statuses: {
            active: t("statusActive"),
            pending: t("statusPending"),
            disabled: t("statusDisabled"),
            new: t("statusNew"),
            deleted: t("statusDeleted"),
        },
        actions: {
            open: t("actionOpen"),
            pay: t("actionPay"),
            showReason: t("actionShowReason"),
            restore: t("actionRestore"),
        },
    }
    if (!isWide) return null
    return (
        <WorkspacesTableBase
            props={{
                slot: lobby.slot,
                placeholder: LOBBY_PLACEHOLDER,
                labels: slotLabels(t("empty")),
                copy,
            }}
            on={lobby.on}
        />
    )
}
