import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { agentPageTabsOf } from "@/modules/page-header"
import { APP_ROUTES, workspaceHref } from "@/modules/routes"
import { AgentsCatalogPageBase } from "./component"

/** The document title of the catalogue page. */
export const agentsCatalogMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("catalogTitle") }
}

/** What the route hands the page: the workspace it is opened in. */
interface AgentsCatalogPageProps {
    readonly workspaceId: string
}

/** The agents page: the trail and heading; the catalogue block under them reads the installed agents in the browser. */
export const AgentsCatalogPage = async (props: AgentsCatalogPageProps): Promise<ReactElement> => {
    const [t, ts, tt, tm] = await Promise.all([
        getTranslations("modulesCore"),
        getTranslations("shell"),
        getTranslations("agentTemplates"),
        getTranslations("agentMarketplace"),
    ])
    return (
        <AgentsCatalogPageBase
            props={{
                crumbLabel: ts("crumbLabel"),
                crumbs: [
                    {
                        id: "home",
                        label: ts("crumbHome"),
                        href: workspaceHref(props.workspaceId, APP_ROUTES.dashboard),
                    },
                    { id: "modules", label: t("catalogTitle") },
                ],
                title: t("catalogTitle"),
                description: t("catalogDescription"),
                tabs: agentPageTabsOf({
                    workspaceId: props.workspaceId,
                    label: tt("tabsLabel"),
                    selected: "running",
                    runningLabel: tt("tabRunning"),
                    marketplaceLabel: tm("title"),
                    templatesLabel: tt("title"),
                }),
            }}
        />
    )
}
