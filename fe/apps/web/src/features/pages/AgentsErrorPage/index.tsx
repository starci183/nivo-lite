import { useLocale, useTranslations } from "next-intl"
import { useParams } from "next/navigation"
import { agentTypeName, isModuleKey } from "@/modules/catalog"
import { AGENTS_ROUTE, agentHref } from "@/modules/installations"
import { APP_ROUTES } from "@/modules/routes"
import { AgentsErrorPageBase } from "./component"

/** Where in the agents area the failure happened. */
type AgentsErrorScope = "catalog" | "frame" | "list" | "setup" | "settings" | "workbench"

type AgentsErrorPageProps = {
    readonly scope: AgentsErrorScope
    readonly onRetry: () => void
}

/** A failed route of the agents area keeps its own trail and heading and shows one Alert with the retry. */
export const AgentsErrorPage = (props: AgentsErrorPageProps) => {
    const t = useTranslations("modulesCore")
    const ts = useTranslations("shell")
    const locale = useLocale() === "en" ? "en" : "vi"
    const { module } = useParams<{ module?: string }>()
    const known = isModuleKey(module) ? module : null
    const typeName = known === null ? t("catalogTitle") : agentTypeName(known, locale)
    const home = { id: "home", label: ts("crumbHome"), href: APP_ROUTES.dashboard }
    const agents = { id: "modules", label: t("catalogTitle"), href: AGENTS_ROUTE }
    const titles = {
        catalog: t("catalogTitle"),
        frame: t("catalogTitle"),
        list: typeName,
        setup: t("tab_setup"),
        settings: t("tab_settings"),
        workbench: t("tab_workbench"),
    }
    const tab = { id: "module", label: typeName, href: agentHref(known ?? "chatbot", null) }
    const crumbs = {
        catalog: [home, { id: "modules", label: t("catalogTitle") }],
        frame: [home, agents],
        list: [home, agents, { id: "module", label: typeName }],
        setup: [home, agents, tab],
        settings: [home, agents, tab],
        workbench: [home, agents, tab],
    }
    return (
        <AgentsErrorPageBase
            props={{ crumbs: crumbs[props.scope], title: titles[props.scope] }}
            on={{ retry: props.onRetry }}
        />
    )
}
