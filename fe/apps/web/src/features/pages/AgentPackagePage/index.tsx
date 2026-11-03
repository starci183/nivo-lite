import type { Metadata } from "next"
import type { ReactElement } from "react"
import { getTranslations } from "next-intl/server"
import { APP_ROUTES } from "@/modules/routes"
import { AGENTS_ROUTE } from "@/modules/routes"
import { AgentPackagePageBase } from "./component"

/** The document title of the AgentPackage page. */
export const agentPackageMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("agentTemplates")
    return { title: t("packageTitle") }
}

/** The AgentPackage page: the trail and heading; the block under them reads its data in the browser. */
export const AgentPackagePage = async (props: { readonly installationId: string }): Promise<ReactElement> => {
    const [t, ts] = await Promise.all([getTranslations("agentTemplates"), getTranslations("shell")])
    return (
        <AgentPackagePageBase
            props={{
                crumbLabel: ts("crumbLabel"),
                crumbs: [
                    { id: "home", label: ts("crumbHome"), href: APP_ROUTES.dashboard },
                    { id: "agents", label: t("crumbAgents"), href: AGENTS_ROUTE },
                    { id: "AgentPackage", label: t("packageTitle") },
                ],
                title: t("packageTitle"),
                description: t("description"),
                installationId: props.installationId,
            }}
        />
    )
}
