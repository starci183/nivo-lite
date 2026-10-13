import type { Metadata } from "next"
import { getLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import { listConnections } from "@/lib/channels"
import { resolveTypeRoute } from "@/lib/agent-routes"
import { isManagerRole } from "@/lib/members-shared"
import { listInstances } from "@/lib/modules-core"
import { getSession } from "@/lib/session"
import { MODULE_REGISTRY, isModuleKey, pickCopy } from "@/modules/catalog"
import { AGENTS_ROUTE } from "@/modules/installations"
import { navigation } from "@/modules/i18n"
import { AgentTypePageBase } from "./component"

/** What the route hands the page: the type of the url and its query. */
type AgentTypePageProps = {
    readonly module: string
    readonly search: Readonly<Record<string, string | string[] | undefined>>
}

/** The document title of the list of the instances of a type. */
export const agentTypeMetadata = async (props: { readonly module: string }): Promise<Metadata> => {
    const locale = (await getLocale()) === "en" ? "en" : "vi"
    return { title: isModuleKey(props.module) ? pickCopy(MODULE_REGISTRY[props.module].name, locale) : "" }
}

/**
 * The type of an agent: the only instance opens directly (its Setup tab); several instances, or the list flag, show the list of
 * instances with the way to add a new one for multi-instance types. Not installed: back to the catalogue.
 */
export const AgentTypePage = async (props: AgentTypePageProps) => {
    if (!isModuleKey(props.module)) notFound()
    const moduleKey = props.module
    const locale = (await getLocale()) === "en" ? "en" : "vi"
    if (!props.search.list) {
        const target = await resolveTypeRoute(moduleKey, "setup", props.search)
        if (target) return navigation.redirect({ href: target, locale })
    }
    const [session, instances] = await Promise.all([getSession(), listInstances(moduleKey)])
    if (instances.length === 0) return navigation.redirect({ href: AGENTS_ROUTE, locale })
    const connections = await listConnections(session.workspace.id)
    return (
        <AgentTypePageBase
            props={{
                moduleKey,
                rows: instances.map((installation) => ({
                    installation,
                    connections:
                        installation.agentId === null
                            ? []
                            : connections
                                  .filter(
                                      (c) =>
                                          c.status !== "disconnected" &&
                                          c.agentIds.includes(installation.agentId ?? ""),
                                  )
                                  .map((c) => c.name),
                })),
                canInstall: isManagerRole(session.member.role),
            }}
        />
    )
}
