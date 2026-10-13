"use client"

import { useTranslations } from "next-intl"
import { useInstanceHeader } from "@/hooks/installations"
import type { ModuleKey } from "@/hooks/installations"
import { AGENTS_ROUTE, APP_ROUTES } from "@/modules/routes"
import { AgentInstanceHeaderBase } from "./component"

/** What the layout hands the header: the type and the instance of the url. */
interface AgentInstanceHeaderProps {
    readonly module: ModuleKey
    readonly installationId: string
}

/** The connected header of an agent instance: a multi-instance type shows the instance name as the heading and the type in the trail. */
export const AgentInstanceHeader = (props: AgentInstanceHeaderProps) => {
    const t = useTranslations("modulesCore")
    const ts = useTranslations("shell")
    const header = useInstanceHeader(props.module, props.installationId)
    return (
        <AgentInstanceHeaderBase
            props={{
                crumbLabel: ts("crumbLabel"),
                crumbs: [
                    { id: "home", label: ts("crumbHome"), href: APP_ROUTES.dashboard },
                    { id: "modules", label: t("catalogTitle"), href: AGENTS_ROUTE },
                    header.listHref === null
                        ? { id: "module", label: header.typeName }
                        : { id: "module", label: header.typeName, href: header.listHref },
                ],
                mascot: header.mascot,
                title: header.multiName ?? header.typeName,
                isEarly: header.isEarly,
                earlyLabel: t("earlyBadge"),
                statusLabel: t(`status_${header.status}`),
                statusTone: header.statusTone,
                typeLine: header.multiName === null ? null : header.typeName,
                versionLabel:
                    header.activeVersion === null
                        ? t("noVersion")
                        : t("versionInUse", { version: header.activeVersion }),
                liveLabel: header.isLive ? t("liveOn") : t("liveOff"),
                isLoading: header.isLoading,
            }}
        />
    )
}
