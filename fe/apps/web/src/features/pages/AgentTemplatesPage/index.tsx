import type { Metadata } from "next"
import type { ReactElement } from "react"
import { getTranslations } from "next-intl/server"
import { agentsSubpageCrumbsOf } from "@/modules/page-header"
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

/** The agent templates page: the trail and heading of the view; the block under them reads its data in the browser. */
export const AgentTemplatesPage = async (props: AgentTemplatesPageProps): Promise<ReactElement> => {
    const words = WORDS[props.view]
    const [t, ts] = await Promise.all([getTranslations(words.ns), getTranslations("shell")])
    return (
        <AgentTemplatesPageBase
            props={{
                view: props.view,
                installationId: props.installationId ?? "",
                crumbLabel: ts("crumbLabel"),
                crumbs: agentsSubpageCrumbsOf({
                    home: ts("crumbHome"),
                    agents: t("crumbAgents"),
                    current: t(words.title),
                }),
                title: t(words.title),
                description: t("description"),
            }}
        />
    )
}
