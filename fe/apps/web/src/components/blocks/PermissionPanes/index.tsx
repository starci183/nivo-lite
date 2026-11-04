"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { paneGridOf, usePaneCopy } from "@/hooks/paneFrame"
import { usePermissionBoard, usePermissionDrawer } from "@/hooks/permissions"
import { useSlotLabels } from "@/hooks/slot"
import { PermissionPanesBase } from "./component"
import type { PermissionPanesCopy } from "./component"

/** The words of the panes: the page, the list, the search and the blank. */
const copyOf = (
    t: ReturnType<typeof useTranslations<"permissions">>,
    team: ReturnType<typeof useTranslations<"team">>,
    pane: ReturnType<typeof usePaneCopy>,
): PermissionPanesCopy => ({
    grid: t("gridLabel"),
    title: team("title"),
    description: team("description"),
    tabsLabel: t("tabsLabel"),
    membersTab: t("tabMembers"),
    permissionsTab: t("tabPermissions"),
    listTitle: t("tableTitle"),
    listLabel: t("listLabel"),
    detailLabel: t("detailLabel"),
    footnote: t("footnote"),
    searchLabel: t("searchLabel"),
    searchPlaceholder: t("searchPlaceholder"),
    clearSearch: pane.clearSearch,
    pickTitle: t("pickTitle"),
    pickBody: t("pickBody"),
    noMatchTitle: pane.noMatchTitle,
    back: pane.backToList,
})

/**
 * The rules of the Quyen page as list and detail: every kind of work by department beside the form of the open one. The open rule
 * lives in the drawer hook, so a phone shows the form while a rule is open and the list otherwise.
 */
export const PermissionPanes = () => {
    const t = useTranslations("permissions")
    const team = useTranslations("team")
    const pane = usePaneCopy()
    const slotLabels = useSlotLabels()
    const board = usePermissionBoard()
    const drawer = usePermissionDrawer(board)
    const [query, setQuery] = useState("")
    const open = (id: string) => {
        const row = ("items" in board.slot ? board.slot.items : []).find((one) => one.id === id)
        if (row !== undefined && !board.isLocked) drawer.open(row.rule)
    }
    return (
        <PermissionPanesBase
            props={{
                copy: copyOf(t, team, pane),
                grid: paneGridOf({ hasList: true, hasAside: false, phone: drawer.openedId === null ? "list" : "main" }),
                isLocked: board.isLocked,
                slot: board.slot,
                placeholder: board.placeholder,
                labels: { ...slotLabels(t("loadFailTitle")), error: t("loadFailBody") },
                query,
                openedId: drawer.openedId,
                form: drawer.props,
                grantsSlot: drawer.grantsSlot,
                grantsPlaceholder: drawer.props === null ? [] : drawer.props.grants,
                grantsLabels:
                    drawer.props === null
                        ? drawer.grantsLabels
                        : { ...drawer.grantsLabels, empty: drawer.props.copy.ownerAlways },
            }}
            on={{ ...drawer.on, setQuery, open, retry: board.reload, retryGrants: drawer.retryGrants }}
        />
    )
}
