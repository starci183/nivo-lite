import type { Metadata } from "next"
import type { ReactElement } from "react"
import { getTranslations } from "next-intl/server"
import { agentPageTabsOf, agentsSubpageCrumbsOf } from "@/modules/page-header"
import { AgentTemplatesPageBase } from "./component"
import type { AgentTemplatesView } from "./component"

/** What the route hands the page: the view, and for the packaging view the installation. */
interface AgentTemplatesPageProps {
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
    const [t, tm, tt, ts] = await Promise.all([
        getTranslations(words.ns),
        getTranslations("agentMarketplace"),
        getTranslations("agentTemplates"),
        getTranslations("shell"),
    ])
    const tabbed = isTabbed(props.view)
    const title = tabbed ? tt("pageTitle") : t(words.title)
    return (
        <AgentTemplatesPageBase
            props={{
                view: props.view,
                installationId: props.installationId ?? "",
                crumbLabel: ts("crumbLabel"),
                crumbs: agentsSubpageCrumbsOf({ home: ts("crumbHome"), agents: t("crumbAgents"), current: title }),
                title,
                description: tabbed ? tt("pageDescription") : t("description"),
                tabs: tabbed
                    ? agentPageTabsOf({
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
