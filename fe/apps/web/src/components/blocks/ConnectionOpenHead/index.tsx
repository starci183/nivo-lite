"use client"

import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { useConnectionPageTabs } from "@/hooks/connectionPage"
import { useProviderCrumb } from "@/hooks/connectionProvider"
import { useConnectionRefusal } from "@/hooks/connections"
import { useConnectionOpenPage } from "@/hooks/connectionsPanes"
import { useWorkspaceId } from "@/hooks/workspaces"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { ConnectionOpenHeadBase } from "./component"

/** The routed page the band sits over. */
interface ConnectionOpenHeadProps {
    readonly children: ReactNode
}

/**
 * The connected band of a connection without a page of its own: name, status, facts, the row's one command and menu, the tabs. It
 * reads the connection its segment layout read once for the band and the tab body. An id that is no connection of the workspace is
 * `notFound()` once. The root of the open route layout: it draws the one Page of every route under it.
 */
export const ConnectionOpenHead = (props: ConnectionOpenHeadProps) => {
    const t = useTranslations("connections")
    const workspaceId = useWorkspaceId()
    const open = useConnectionOpenPage()
    const providerCrumb = useProviderCrumb(open.provider)
    const tabs = useConnectionPageTabs(open.hasAgents ? open.agentCount : undefined)
    const refusal = useConnectionRefusal()
    if (open.isMissing && refusal === undefined) notFound()
    const view = "items" in open.slot ? open.slot.items : undefined
    return (
        <ConnectionOpenHeadBase
            props={{
                ...(view === undefined ? {} : { view }),
                ...(open.chip === null ? {} : { chip: open.chip }),
                glyph: open.glyph,
                crumbsLabel: t("crumbLabel"),
                crumbs: [
                    {
                        id: "connections",
                        label: t("title"),
                        href: workspaceHref(workspaceId, CONSOLE_ROUTES.connections),
                    },
                    ...(providerCrumb === undefined ? [] : [providerCrumb]),
                    { id: "open", label: view?.title ?? t("openLabel") },
                ],
                tabs,
                moreLabel: t("moreActions"),
                ...(refusal === undefined ? {} : { refusal }),
            }}
            on={open.on}
            children={props.children}
        />
    )
}
