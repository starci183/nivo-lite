"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { useConnectionsList, visibleRowsOf } from "@/hooks/connectionsPanes"
import { usePaneCopy } from "@/hooks/paneFrame"
import { useProviderTemplateCandidates } from "@/hooks/providerRights"
import { useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { ConnectionsHomeBase } from "./component"
import { connectionsCopyOf } from "./copy"
import { pendingViewsOf } from "./pendingView"
import { useWorkspaceId } from "@/hooks/workspaces"

/**
 * The Connected tab of the Connections page: reads the workspace's connections, keeps the search and the filter of the list, and
 * sends each action and row to the connection's own page.
 */
export const ConnectionsHome = () => {
    const t = useTranslations("connections")
    const tRights = useTranslations("agentRights")
    const pending = useProviderTemplateCandidates()
    const format = useFormatter()
    const pane = usePaneCopy()
    const locale = useLocale()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const labels = useSlotLabels()
    const list = useConnectionsList()
    const [text, setText] = useState("")
    const [filter, setFilter] = useState("all")
    const view = "items" in list.slot ? list.slot.items : undefined
    const counts = { total: view?.figures.total ?? 0, agentsTotal: view?.figures.agentsTotal ?? 0 }
    return (
        <ConnectionsHomeBase
            props={{
                copy: connectionsCopyOf(t, pane, counts),
                locale,
                slot: list.slot,
                labels: labels(t("connectedEmpty")),
                rows: view === undefined ? [] : visibleRowsOf(view.rows, filter, text),
                filter,
                text,
                pending: pendingViewsOf(tRights, format, locale, pending.rows),
            }}
            on={{
                later: (id) => pending.dismiss(id),
                attachByTemplate: (id) => void pending.attach(id),
                goTo: (href) => router.push(href),
                openLibrary: () => router.push(workspaceHref(workspaceId, `${CONSOLE_ROUTES.connections}?tab=library`)),
                retry: list.retry,
                filter: setFilter,
                text: setText,
                clearFilters: () => {
                    setText("")
                    setFilter("all")
                },
            }}
        />
    )
}
