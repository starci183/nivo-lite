import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { APP_ROUTES } from "@/modules/routes"
import { AgentsCatalogPageBase } from "./component"

/** The document title of the catalogue page. */
export const agentsCatalogMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("catalogTitle") }
}

/** /agents: the trail and heading; the catalogue block under them reads the installed agents in the browser. */
export const AgentsCatalogPage = async () => {
    const [t, ts] = await Promise.all([getTranslations("modulesCore"), getTranslations("shell")])
    return (
        <AgentsCatalogPageBase
            props={{
                crumbLabel: ts("crumbLabel"),
                crumbs: [
                    { id: "home", label: ts("crumbHome"), href: APP_ROUTES.dashboard },
                    { id: "modules", label: t("catalogTitle") },
                ],
                eyebrow: t("eyebrow"),
                title: t("catalogTitle"),
                description: t("catalogDescription"),
            }}
        />
    )
}
