"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { LOBBY_PLACEHOLDER, useLobbyView, useLobbyWide } from "@/hooks/lobby"
import { useSlotLabels } from "@/hooks/slot"
import type { WorkspacesStackCopy } from "@/modules/types"
import { WorkspacesStackBase } from "./component"

/** The connected phone stack of a narrow screen: the lobby rows stacked, each ⋯ opening its bottom sheet. */
export const WorkspacesStack = () => {
    const t = useTranslations("workspacesPhone")
    const slotLabels = useSlotLabels()
    const lobby = useLobbyView()
    const isWide = useLobbyWide()
    const [sheetId, setSheetId] = useState<string | undefined>(undefined)
    const copy: WorkspacesStackCopy = {
        title: t("title"),
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
        sheetClose: t("sheetClose"),
    }
    if (isWide) return null
    return (
        <WorkspacesStackBase
            props={{
                slot: lobby.slot,
                placeholder: LOBBY_PLACEHOLDER,
                labels: slotLabels(t("empty")),
                copy,
                sheetId,
            }}
            on={{ ...lobby.on, sheet: setSheetId }}
        />
    )
}
