import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PROVIDER_GROUPS, providerKey } from "@/hooks/connection-providers"
import {
    attentionConnections,
    CONNECTION_ROUTES,
    GROUP_TITLE_KEY,
    liveConnections,
    sortRows,
    URL_PARAMS,
} from "@/hooks/connections"
import { publicSiteUrl } from "@/lib/channels"
import { getCurrentMember, isManagerRole } from "@/lib/members"
import { getSession } from "@/lib/session"
import { readAgents } from "@/modules/db/connections/read-agents"
import { readConnections } from "@/modules/db/connections/read-connections"
import { ConnectionsPageBase } from "./component"
import type { PageGroup, PageWords } from "./component"

/** The next-intl namespace of the page. */
const NAMESPACE = "connections"

type Params = Record<string, string | string[] | undefined>

/** The query string of the request, awaited by the route. */
type ConnectionsPageProps = {
    readonly searchParams?: Promise<Params>
}

const NO_PARAMS: Params = {}

const modeOf = (manager: boolean, loaded: boolean): "ready" | "forbidden" | "failed" => {
    if (!manager) return "forbidden"
    return loaded ? "ready" : "failed"
}

/** The document title of the Connections page. */
export const connectionsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations(NAMESPACE)
    return { title: t("title") }
}

/**
 * The Connections page (owner | manager): the grouped board of what is connected, or the connector library. It reads under RLS and
 * hands plain data and words to the pure drawing; the wizard and the connector detail open as drawers driven by the URL.
 */
export const ConnectionsPage = async (props: ConnectionsPageProps) => {
    const t = await getTranslations(NAMESPACE)
    const me = await getCurrentMember()
    const manager = isManagerRole(me.role)
    const [connections, agentRows, session, params] = await Promise.all([
        manager ? readConnections(me.workspaceId) : undefined,
        manager ? readAgents(me.workspaceId) : undefined,
        getSession(),
        props.searchParams ?? Promise.resolve(NO_PARAMS),
    ])
    const items = connections?.kind === "ok" ? connections.value : []
    const everyAgent = agentRows?.kind === "ok" ? agentRows.value : []
    const loaded = connections?.kind === "ok" && agentRows?.kind === "ok"
    const live = liveConnections(items)
    const attention = attentionConnections(items)
    const first = attention[0]
    const agentNames = Object.fromEntries(everyAgent.map((agent) => [agent.id, agent.name]))
    const namesOf = (agentIds: ReadonlyArray<string>) =>
        agentIds.map((id) => agentNames[id]).filter((name): name is string => name !== undefined)
    const showsLibrary =
        params[URL_PARAMS.tab] === "library" || (params[URL_PARAMS.tab] !== "connected" && live.length === 0)

    const groups: ReadonlyArray<PageGroup> = PROVIDER_GROUPS.map((group) => ({
        id: group.id,
        title: t(GROUP_TITLE_KEY[group.id]),
        count: items.filter((item) => group.providers.includes(item.provider)).length,
        cards: group.providers
            .filter((provider) => items.some((item) => item.provider === provider))
            .map((provider) => {
                const rows = sortRows(items.filter((item) => item.provider === provider))
                return {
                    provider,
                    title: t(providerKey(provider, "title")),
                    fact: t("connectionCount", { count: rows.length }),
                    rows: rows.map((connection) => ({ connection, agentNames: namesOf(connection.agentIds) })),
                }
            }),
    })).filter((group) => group.cards.length > 0)

    const words: PageWords = {
        title: t("title"),
        description: t("description"),
        crumbLabel: t("crumbLabel"),
        crumbHome: t("crumbHome"),
        homeHref: CONNECTION_ROUTES.dashboard,
        summary:
            attention.length > 0
                ? t("summary", { live: live.length, attention: attention.length })
                : t("summaryCalm", { live: live.length }),
        ownerOnly: t("ownerOnly"),
        emptyTitle: t("connectedEmpty"),
        emptyHint: t("connectedEmptyHint"),
        automationsLink: t("automationsLink"),
        automationsHref: CONNECTION_ROUTES.automations,
        loadFailed: t("loadFailed"),
        forbiddenTitle: t("forbiddenTitle"),
        forbiddenBody: t("forbiddenBody"),
        forbiddenBack: t("forbiddenBack"),
        forbiddenHref: CONNECTION_ROUTES.chat,
    }

    return (
        <ConnectionsPageBase
            props={{
                mode: modeOf(manager, loaded),
                words,
                view: showsLibrary ? "library" : "connected",
                workspaceId: me.workspaceId,
                ownerEmail: session.email,
                canManage: me.role === "owner",
                localOnly: publicSiteUrl() === null,
                items,
                agents: everyAgent.filter((agent) => agent.status === "active"),
                agentNames,
                liveCount: live.length,
                attention: first === undefined ? null : { first, count: attention.length },
                groups,
            }}
        />
    )
}
