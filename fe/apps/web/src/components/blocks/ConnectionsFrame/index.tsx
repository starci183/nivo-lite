"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { ConnectionsHeadContent } from "@/components/composites/ConnectionsHead"
import {
    attentionConnections,
    CONNECTION_ROUTES,
    liveConnections,
    URL_PARAMS,
    useConnectionOverlays,
    useConnectionsData,
    useConnectionsRole,
} from "@/hooks/connections"
import { ConnectionsFrameBase } from "./component"

/** What the route hands the frame: the tab the query string asked for, and the page body. */
interface ConnectionsFrameProps {
    readonly tab?: string | undefined
    readonly children: ReactNode
}

/** The Connections `Page`: its header reads the workspace (live count, summary) and selects the Connected / Library tab. */
export const ConnectionsFrame = (props: ConnectionsFrameProps) => {
    const t = useTranslations("connections")
    const { role, isLoading: isRoleLoading } = useConnectionsRole()
    const data = useConnectionsData()
    const overlays = useConnectionOverlays()
    const manager = role === "owner" || role === "manager"
    const live = liveConnections(data.items)
    const attention = attentionConnections(data.items)
    const showsLibrary = props.tab === "library" || (props.tab !== "connected" && live.length === 0)
    const isReady = !(isRoleLoading || (manager && data.isLoading)) && manager && !data.failed
    const summary =
        attention.length > 0
            ? t("summary", { live: live.length, attention: attention.length })
            : t("summaryCalm", { live: live.length })
    const placeholderView = props.tab === "library" ? "library" : "connected"
    const readyView = showsLibrary ? "library" : "connected"
    return (
        <ConnectionsFrameBase
            shape={{ body: props.children }}
            props={{
                header: ConnectionsHeadContent({
                    crumbLabel: t("crumbLabel"),
                    homeLabel: t("crumbHome"),
                    homeHref: CONNECTION_ROUTES.dashboard,
                    title: t("title"),
                    addLabel: t("add"),
                    addHref: `${CONNECTION_ROUTES.connections}?${URL_PARAMS.tab}=library`,
                    description: t("description"),
                    ...(isReady ? { meta: summary } : {}),
                    tabs: {
                        label: t("title"),
                        selectedKey: isReady ? readyView : placeholderView,
                        onSelect: (key) => {
                            overlays.setTab(key === "library" ? "library" : "connected")
                        },
                        items: [
                            {
                                id: "connected",
                                label: isReady ? `${t("tabConnected")} · ${live.length}` : t("tabConnected"),
                            },
                            { id: "library", label: t("tabLibrary") },
                        ],
                    },
                }),
            }}
        />
    )
}
