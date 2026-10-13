import { getLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import { resolveTypeRoute } from "@/lib/agent-routes"
import { isModuleKey } from "@/modules/catalog"
import { agentListHref } from "@/modules/installations"
import type { AgentTab } from "@/modules/installations"
import { navigation } from "@/modules/i18n"

/** What the route hands the page: the type of the old url, the tab it named and its query. */
type AgentTypeRedirectPageProps = {
    readonly module: string
    readonly tab: AgentTab
    readonly search: Readonly<Record<string, string | string[] | undefined>>
}

/** The url of a tab before agents became instances: to the only instance, or the instance that owns the focus of the query, else the list. */
export const AgentTypeRedirectPage = async (props: AgentTypeRedirectPageProps) => {
    if (!isModuleKey(props.module)) notFound()
    const locale = (await getLocale()) === "en" ? "en" : "vi"
    const target = (await resolveTypeRoute(props.module, props.tab, props.search)) ?? agentListHref(props.module)
    return navigation.redirect({ href: target, locale })
}
