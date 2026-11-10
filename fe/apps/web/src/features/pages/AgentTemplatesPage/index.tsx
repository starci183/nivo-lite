import type { Metadata } from "next"
import type { ReactElement } from "react"
import { getTranslations } from "next-intl/server"
import { agentPageTabsOf, agentsSubpageCrumbsOf } from "@/modules/page-header"
import { APP_ROUTES, workspaceHref } from "@/modules/routes"
import { AgentTemplatesPageBase, type AgentTemplatesView } from "./component"

/** What the route hands the page: the view, and for the packaging view the installation. */
interface AgentTemplatesPageProps {
    readonly workspaceId: string
    readonly view: AgentTemplatesView
    readonly installationId?: string | undefined
}

/** The message namespace and the key of the title of each view. */
const WORDS = {
    templates: { ns: "agentTemplates", title: "title" },
    marketplace: { ns: "agentMarketplace", title: "title" },
    package: { ns: "agentTemplates", title: "packageTitle" },
} as const

/** The document title of one view of the agent templates page. */
export const agentTemplatesMetadataOf =
    (view: AgentTemplatesView): (() => Promise<Metadata>) =>
    async (): Promise<Metadata> => {
        const t = await getTranslations(WORDS[view].ns)
        return { title: t(WORDS[view].title) }
    }

/** The two views that share the page title and its tab line; the packaging view has its own title and no tabs. */
const isTabbed = (view: AgentTemplatesView): boolean => view !== "package"

/** The agent templates page: the trail and heading of the view, the tab line of the two list views; the block under them reads its data in the browser. */
export const AgentTemplatesPage = async (props: AgentTemplatesPageProps): Promise<ReactElement> => {
    const words = WORDS[props.view]
    const [t, tm, tt, ts, tc] = await Promise.all([
        getTranslations(words.ns),
        getTranslations("agentMarketplace"),
        getTranslations("agentTemplates"),
        getTranslations("shell"),
        getTranslations("agentCatalog"),
    ])
    const tabbed = isTabbed(props.view)
    /** The tabs are views of the one Agent page: they keep its title, its description and its trail. */
    const title = tabbed ? tc("title") : t(words.title)
    return (
        <AgentTemplatesPageBase
            props={{
                view: props.view,
                installationId: props.installationId ?? "",
                crumbLabel: ts("crumbLabel"),
                crumbs: tabbed
                    ? [
                          {
                              id: "home",
                              label: ts("crumbHome"),
                              href: workspaceHref(props.workspaceId, APP_ROUTES.workspaceHome),
                          },
                          { id: "modules", label: title },
                      ]
                    : agentsSubpageCrumbsOf({
                          workspaceId: props.workspaceId,
                          home: ts("crumbHome"),
                          agents: t("crumbAgents"),
                          current: title,
                      }),
                title,
                description: tabbed ? tc("description") : t("description"),
                tabs: tabbed
                    ? agentPageTabsOf({
                          workspaceId: props.workspaceId,
                          label: tt("tabsLabel"),
                          selected: props.view === "marketplace" ? "marketplace" : "templates",
                          runningLabel: tt("tabRunning"),
                          marketplaceLabel: tm("title"),
                          templatesLabel: tt("title"),
                      })
                    : null,
            }}
        />
    )
}
