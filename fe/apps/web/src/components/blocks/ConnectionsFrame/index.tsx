"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import type { ReactNode } from "react"
import { URL_PARAMS } from "@/hooks/connections"
import { useSlotLabels } from "@/hooks/slot"
import { useConnectionsList, visibleRowsOf } from "@/hooks/connectionsPanes"
import { connectionsGridOf } from "@/hooks/connectionsRoute"
import { usePaneCopy } from "@/hooks/paneFrame"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { ConnectionsFrameBase } from "./component"

/** What the routed page hands the frame: the page that sits beside the list. */
interface ConnectionsFrameProps {
    readonly children: ReactNode
}

/**
 * The connected frame of the Connections pages: reads the workspace's connections and the viewer's role, keeps the search and the
 * filter of the list, and draws the page band and the list beside whichever page the route is. The open connection comes from the
 * address, so a refresh and a shared link keep it.
 */
export const ConnectionsFrame = (props: ConnectionsFrameProps) => {
    const t = useTranslations("connections")
    const shell = useTranslations("shell")
    const pane = usePaneCopy()
    const router = navigation.useRouter()
    const labels = useSlotLabels()
    const list = useConnectionsList()
    const [text, setText] = useState("")
    const [filter, setFilter] = useState("all")
    const view = "items" in list.slot ? list.slot.items : undefined
    const rows = view === undefined ? [] : visibleRowsOf(view.rows, filter, text)
    return (
        <ConnectionsFrameBase
            props={{
                copy: {
                    grid: t("title"),
                    listLabel: t("listLabel"),
                    title: t("title"),
                    crumbLabel: shell("crumbLabel"),
                    tabsLabel: t("title"),
                    tabLibrary: t("tabLibrary"),
                    errorBody: pane.errorBody,
                    noMatchTitle: pane.noMatchTitle,
                    noMatchBody: pane.noMatchBody,
                    clearFilters: pane.clearFilters,
                },
                crumbs: [
                    { id: "home", label: shell("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                    list.openName === null
                        ? { id: "connections", label: t("title") }
                        : { id: "connections", label: t("title"), href: CONSOLE_ROUTES.connections },
                    ...(list.openName === null ? [] : [{ id: "open", label: list.openName }]),
                ],
                tab: list.tab,
                connectedLabel: view === undefined ? t("tabConnected") : `${t("tabConnected")} · ${view.rows.length}`,
                tabHrefs: {
                    connected: CONSOLE_ROUTES.connections,
                    library: `${CONSOLE_ROUTES.connections}?tab=library`,
                },
                slot: list.slot,
                labels: labels(t("connectedEmpty")),
                search: {
                    label: t("libSearch"),
                    placeholder: t("libSearch"),
                    clearLabel: t("libClear"),
                    value: text,
                    onChange: setText,
                },
                choice: {
                    label: t("filterLabel"),
                    value: filter,
                    onChange: setFilter,
                    moreLabel: pane.moreFilters,
                    searchLabel: pane.filterSearch,
                    emptyLabel: pane.filterNoMatch,
                },
                rows,
                openId: list.openId,
                grid: connectionsGridOf({ hasList: view === undefined || view.liveCount > 0, isRoot: list.isRoot }),
            }}
            on={{
                open: (row) => router.push(row.href ?? `${CONSOLE_ROUTES.connections}?${URL_PARAMS.open}=${row.id}`),
                retry: list.retry,
                continueSetup: (href) => router.push(href),
                clearFilters: () => {
                    setText("")
                    setFilter("all")
                },
            }}
            children={props.children}
        />
    )
}
