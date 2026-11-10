import { useTranslations } from "next-intl"
import { useParams } from "next/navigation"
import { useModuleName } from "@/hooks/installations"
import { useWorkspaceId } from "@/hooks/workspaces"
import { isModuleKey } from "@/modules/catalog"
import { agentHref } from "@/modules/installations"
import { AGENTS_ROUTE, APP_ROUTES, workspaceHref } from "@/modules/routes"
import { AgentsErrorPageBase } from "./component"

/** Where in the agents area the failure happened. */
type AgentsErrorScope =
    "catalog" | "frame" | "list" | "setup" | "connections" | "knowledge" | "workbench" | "performance" | "work" | "graph" | "chat"

type AgentsErrorPageProps = {
    readonly scope: AgentsErrorScope
    readonly onRetry: () => void
}

/** A failed route of the agents area keeps its own trail and heading and shows one Alert with the retry. */
export const AgentsErrorPage = (props: AgentsErrorPageProps) => {
    const t = useTranslations("modulesCore")
    const ts = useTranslations("shell")
    const { module } = useParams<{ module?: string }>()
    const workspaceId = useWorkspaceId()
    const known = isModuleKey(module) ? module : null
    const moduleName = useModuleName(known)
    const typeName = moduleName || t("catalogTitle")
    const home = { id: "home", label: ts("crumbHome"), href: workspaceHref(workspaceId, APP_ROUTES.workspaceHome) }
    const agents = { id: "modules", label: t("catalogTitle"), href: workspaceHref(workspaceId, AGENTS_ROUTE) }
    const titles = {
        catalog: t("catalogTitle"),
        frame: t("catalogTitle"),
        list: typeName,
        setup: t("tab_setup"),
        connections: t("tab_connections"),
        knowledge: t("tab_knowledge"),
        workbench: t("tab_workbench"),
        performance: t("tab_performance"),
        work: t("tab_work"),
        chat: t("tab_chat"),
        graph: t("tab_graph"),
    }
    const tab = { id: "module", label: typeName, href: workspaceHref(workspaceId, agentHref(known ?? "chatbot", null)) }
    const crumbs = {
        catalog: [home, { id: "modules", label: t("catalogTitle") }],
        frame: [home, agents],
        list: [home, agents, { id: "module", label: typeName }],
        setup: [home, agents, tab],
        connections: [home, agents, tab],
        knowledge: [home, agents, tab],
        workbench: [home, agents, tab],
        performance: [home, agents, tab],
        work: [home, agents, tab],
        chat: [home, agents, tab],
        graph: [home, agents, tab],
    }
    return (
        <AgentsErrorPageBase
            props={{ crumbs: crumbs[props.scope], title: titles[props.scope] }}
            on={{ retry: props.onRetry }}
        />
    )
}
