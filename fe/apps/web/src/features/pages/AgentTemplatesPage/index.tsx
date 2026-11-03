import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { APP_ROUTES } from "@/modules/routes"
import { AGENTS_ROUTE } from "@/modules/routes"
import { AgentTemplatesPageBase } from "./component"

/** The document title of the AgentTemplates page. */
export const agentTemplatesMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("agentTemplates")
    return { title: t("title") }
}

/** The AgentTemplates page: the trail and heading; the block under them reads its data in the browser. */
export const AgentTemplatesPage = async () => {
    const [t, ts] = await Promise.all([getTranslations("agentTemplates"), getTranslations("shell")])
    return (
        <AgentTemplatesPageBase
            props={{
                crumbLabel: ts("crumbLabel"),
                crumbs: [
                    { id: "home", label: ts("crumbHome"), href: APP_ROUTES.dashboard },
                    { id: "agents", label: t("crumbAgents"), href: AGENTS_ROUTE },
                    { id: "AgentTemplates", label: t("title") },
                ],
                title: t("title"),
                description: t("description"),
            }}
        />
    )
}
