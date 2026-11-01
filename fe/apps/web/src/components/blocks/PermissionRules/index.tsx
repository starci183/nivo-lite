"use client"

import { useTranslations } from "next-intl"
import { usePermissionBoard, usePermissionDrawer } from "@/hooks/permissions"
import { useSlotLabels } from "@/hooks/slot"
import { PermissionRulesBase } from "./component"

/** The rule table of the Quyen page; the drawer that edits one rule lives in its hook, the drawing in the pure half. */
export const PermissionRules = () => {
    const t = useTranslations("permissions")
    const slotLabels = useSlotLabels()
    const board = usePermissionBoard()
    const drawer = usePermissionDrawer(board)
    const open = (id: string) => {
        const row = (board.slot.items ?? []).find((one) => one.id === id)
        if (row !== undefined) drawer.open(row.rule)
    }
    return (
        <PermissionRulesBase
            props={{
                title: t("tableTitle"),
                editLabel: t("edit"),
                footnote: t("footnote"),
                isLocked: board.isLocked,
                slot: board.isLocked ? { isForbidden: true } : board.slot,
                placeholder: board.placeholder,
                slotLabels: slotLabels(t("loadFailTitle")),
                drawer: drawer.props,
            }}
            on={{ ...drawer.on, open, retry: board.reload }}
        />
    )
}
