"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import { useConsoleCrumbs } from "@/hooks/pageCrumbs"
import { CATALOG, CONNECTION_GROUPS, FOLDED_CONNECTORS, asGroup, groupOfEntry } from "@/hooks/connection-catalog"
import { useConnectionsList } from "@/hooks/connectionsPanes"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { ConnectionsFrameBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the page hands the frame: the tab's page. */
interface ConnectionsFrameProps {
    readonly children?: ReactNode
}

/**
 * The connected band of the Connections page: reads the workspace's connections for the summary and the tab counts, and the viewer's
 * role for "Add connection". The tab comes from the address, so a refresh and a shared link keep it.
 */
export const ConnectionsFrame = (props: ConnectionsFrameProps) => {
    const t = useTranslations("connections")
    const workspaceId = useWorkspaceId()
    const hubHref = workspaceHref(workspaceId, CONSOLE_ROUTES.connections)
    const breadcrumbs = useConsoleCrumbs(t("title"))
    const list = useConnectionsList()
    const selectedGroup = asGroup(useSearchParams().get("group") ?? "all")
    const entries = CATALOG.filter((entry) => !FOLDED_CONNECTORS.has(entry.id))
    const libraryHref = `${hubHref}?tab=library`
    const categories = {
        label: t("libFilter"),
        selectedKey: selectedGroup,
        items: [
            { id: "all", label: t("group_all"), count: entries.length, href: libraryHref },
            ...CONNECTION_GROUPS.map((id) => ({
                id,
                label: t(`group_${id}`),
                count: entries.filter((entry) => groupOfEntry(entry) === id).length,
                href: `${libraryHref}&group=${id}`,
            })).filter((item) => item.count > 0),
        ],
    }
    const view = "items" in list.slot ? list.slot.items : undefined
    return (
        <ConnectionsFrameBase
            props={{
                breadcrumbs,
                copy: { title: t("title"), tabsLabel: t("title"), addLabel: t("add") },
                tab: list.tab,
                summary: view?.summary ?? t("title"),
                connectedLabel: t("tabConnected"),
                libraryLabel: t("tabLibrary"),
                categories,
                connectedCount: view?.rows.length,
                libraryCount: CATALOG.filter((entry) => !FOLDED_CONNECTORS.has(entry.id)).length,
                tabHrefs: { connected: hubHref, library: `${hubHref}?tab=library` },
                canAdd: view?.canManage === true,
                isLoading: "isLoading" in list.slot,
            }}
            children={props.children}
        />
    )
}
