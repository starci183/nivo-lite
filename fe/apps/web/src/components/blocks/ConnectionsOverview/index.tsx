"use client"

import { useTranslations } from "next-intl"
import { useAuthUser } from "@/hooks/auth"
import { PROVIDER_GROUPS, providerKey } from "@/hooks/connection-providers"
import {
    attentionConnections,
    CONNECTION_ROUTES,
    GROUP_TITLE_KEY,
    isLocalOnly,
    liveConnections,
    sortRows,
    useConnectionsData,
} from "@/hooks/connections"
import { useActiveWorkspace, useWorkspaceCards } from "@/hooks/workspaces"
import { webSiteOrigin } from "@/modules/config"
import { ConnectionsOverviewBase } from "./component"
import type { PageGroup, PageWords } from "./component"

/** What the Connections page tells the overview. */
interface ConnectionsOverviewProps {
    /** The `tab` of the address: `library`, `connected` or none. */
    readonly tab?: string | undefined
}

/** What decides which face the overview shows. */
interface ModeInput {
    readonly isLoading: boolean
    readonly manager: boolean
    readonly failed: boolean
}

const modeOf = (input: ModeInput): "loading" | "ready" | "forbidden" | "failed" => {
    if (input.isLoading) return "loading"
    if (!input.manager) return "forbidden"
    return input.failed ? "failed" : "ready"
}

/**
 * The connected Connections overview (owner | manager): the grouped board of what is connected, or the connector library. It reads the
 * connections and the agents from the back end GraphQL API through SWR and hands plain data and words to the pure drawing; the wizard
 * and the connector detail open as drawers driven by the URL.
 */
export const ConnectionsOverview = (props: ConnectionsOverviewProps) => {
    const t = useTranslations("connections")
    const { activeWorkspaceId } = useActiveWorkspace()
    const workspaces = useWorkspaceCards()
    const user = useAuthUser()
    const role = workspaces.cards.find((card) => card.id === activeWorkspaceId)?.role
    const manager = role === "owner" || role === "manager"
    const data = useConnectionsData()
    const items = data.items
    const agentNames = data.agentNames
    const live = liveConnections(items)
    const attention = attentionConnections(items)
    const first = attention[0]
    const namesOf = (agentIds: ReadonlyArray<string>) =>
        agentIds.map((id) => agentNames[id]).filter((name): name is string => name !== undefined)
    const showsLibrary = props.tab === "library" || (props.tab !== "connected" && live.length === 0)

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

    const isLoading = workspaces.status === "loading" || (manager && data.isLoading)
    const failed = data.failed

    return (
        <ConnectionsOverviewBase
            props={{
                mode: modeOf({ isLoading, manager, failed }),
                words,
                view: showsLibrary ? "library" : "connected",
                ownerEmail: user.data?.email ?? "",
                canManage: role === "owner",
                localOnly: isLocalOnly(webSiteOrigin()),
                items,
                agents: data.activeAgents,
                agentNames,
                liveCount: live.length,
                attention: first === undefined ? null : { first, count: attention.length },
                groups,
            }}
        />
    )
}
