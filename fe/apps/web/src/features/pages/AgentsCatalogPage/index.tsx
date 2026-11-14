import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { APP_ROUTES, workspaceHref } from "@/modules/routes"
import { AgentsCatalogPageBase, type AgentsCatalogPageBaseProps } from "./component"

/** The document title of the catalogue page. */
export const agentsCatalogMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("agentCatalog")
    return { title: t("title") }
}

/** What the route hands the page: the workspace it is opened in. */
interface AgentsCatalogPageProps {
    readonly workspaceId: string
}

/** The words of the page, resolved on the server so the page and its loading state say the same; no workspace while loading. */
const catalogCopy = async (workspaceId?: string): Promise<AgentsCatalogPageBaseProps["props"]> => {
    const [t, ts] = await Promise.all([getTranslations("agentCatalog"), getTranslations("shell")])
    return {
        crumbLabel: ts("crumbLabel"),
        crumbs: [
            {
                id: "home",
                label: ts("crumbHome"),
                ...(workspaceId === undefined ? {} : { href: workspaceHref(workspaceId, APP_ROUTES.workspaceHome) }),
            },
            { id: "modules", label: t("title") },
        ],
        title: t("title"),
        description: t("description"),
    }
}

/** The agents page: the trail and heading; the catalogue block under them reads the installed agents in the browser. */
export const AgentsCatalogPage = async (props: AgentsCatalogPageProps): Promise<ReactElement> => (
    <AgentsCatalogPageBase props={await catalogCopy(props.workspaceId)} />
)

/** The same page while the route loads: the trail, heading and create action stay real, the blocks draw their own skeletons. */
export const AgentsCatalogLoadingPage = async (): Promise<ReactElement> => (
    <AgentsCatalogPageBase props={await catalogCopy()} />
)
