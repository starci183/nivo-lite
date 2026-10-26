"use client"

import { useTranslations } from "next-intl"
import { useInstanceHeader } from "@/hooks/installations"
import type { ModuleKey } from "@/hooks/installations"
import { AGENTS_ROUTE, APP_ROUTES } from "@/modules/routes"
import { AgentInstanceCrumbsBase } from "./component"

/** What the layout hands the trail: the type and the instance of the url. */
interface AgentInstanceCrumbsProps {
    readonly module: ModuleKey
    readonly installationId: string
}

/** The connected trail of an agent instance: home, the agents, and the agent by its name. */
export const AgentInstanceCrumbs = (props: AgentInstanceCrumbsProps) => {
    const t = useTranslations("modulesCore")
    const ts = useTranslations("shell")
    const header = useInstanceHeader(props.module, props.installationId)
    return (
        <AgentInstanceCrumbsBase
            props={{
                crumbLabel: ts("crumbLabel"),
                crumbs: [
                    { id: "home", label: ts("crumbHome"), href: APP_ROUTES.dashboard },
                    { id: "modules", label: t("catalogTitle"), href: AGENTS_ROUTE },
                    { id: "agent", label: header.name === "" ? header.typeName : header.name },
                ],
            }}
        />
    )
}
