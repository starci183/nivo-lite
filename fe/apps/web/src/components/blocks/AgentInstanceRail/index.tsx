"use client"

import { useTranslations } from "next-intl"
import { useInstanceRail } from "@/hooks/installations"
import { AGENTS_ROUTE } from "@/modules/routes"
import { AgentInstanceRailBase } from "./component"

/** What the layout hands the rail: the instance of the url, which is the current one. */
interface AgentInstanceRailProps {
    readonly installationId: string
}

/** The connected switcher of the installed agents: they are read in the browser. */
export const AgentInstanceRail = (props: AgentInstanceRailProps) => {
    const t = useTranslations("modulesCore")
    const rail = useInstanceRail(props.installationId)
    return (
        <AgentInstanceRailBase
            props={{
                navLabel: t("navLabel"),
                allAgentsLabel: t("allModules"),
                allAgentsHref: AGENTS_ROUTE,
                items: rail.items.map((item) => ({
                    id: item.id,
                    href: item.href,
                    name: item.name,
                    mascot: item.mascot,
                    isCurrent: item.isCurrent,
                    statusLabel: t(`status_${item.status}`),
                    statusTone: item.statusTone,
                })),
                isLoading: rail.isLoading,
            }}
        />
    )
}
