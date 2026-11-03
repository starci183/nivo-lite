import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { APP_ROUTES } from "@/modules/routes"
import { AGENTS_ROUTE } from "@/modules/routes"
import { AgentMarketplacePageBase } from "./component"

/** The document title of the AgentMarketplace page. */
export const agentMarketplaceMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("agentMarketplace")
    return { title: t("title") }
}

/** The AgentMarketplace page: the trail and heading; the block under them reads its data in the browser. */
export const AgentMarketplacePage = async () => {
    const [t, ts] = await Promise.all([getTranslations("agentMarketplace"), getTranslations("shell")])
    return (
        <AgentMarketplacePageBase
            props={{
                crumbLabel: ts("crumbLabel"),
                crumbs: [
                    { id: "home", label: ts("crumbHome"), href: APP_ROUTES.dashboard },
                    { id: "agents", label: t("crumbAgents"), href: AGENTS_ROUTE },
                    { id: "AgentMarketplace", label: t("title") },
                ],
                title: t("title"),
                description: t("description"),
            }}
        />
    )
}
