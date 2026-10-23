"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import type { ComponentProps, ReactNode } from "react"
import { ConnectionAddButton } from "@/components/blocks/ConnectionAddButton"
import { ConnectionAttention } from "@/components/blocks/ConnectionAttention"
import { ConnectionLibrary } from "@/components/blocks/ConnectionLibrary"
import { ConnectionRow } from "@/components/blocks/ConnectionRow"
import { ConnectionsOverview, OverlayHost } from "@/components/blocks/ConnectionsOverview"
import { ConnectionViewTabs } from "@/components/blocks/ConnectionViewTabs"
import { McpConnectorForms } from "@/components/composites/McpConnectorForms"
import { McpGatewayRegion } from "@/components/composites/McpGatewayRegion"
import { useQueryAuthUserSwr } from "@/hooks/auth"
import { catalogKey, entryById } from "@/hooks/connection-catalog"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import {
    attentionConnections,
    CONNECTION_ROUTES,
    isLocalOnly,
    liveConnections,
    sortRows,
    URL_PARAMS,
    useConnectionOverlays,
    useConnectionsData,
    connectionGroups,
} from "@/hooks/connections"
import { useMcpGatewayView } from "@/hooks/mcpGateway"
import { useActiveWorkspace, useWorkspaceCards } from "@/hooks/workspaces"
import { webSiteOrigin } from "@/modules/config"
import type { AgentOption, Connection } from "@/modules/types"
import { ConnectorDetailOverlayBase, detailRowsOf, detailModeOf } from "./component"
import type { DetailEntry } from "./component"

/** Workspace inputs supplied by a caller, or read by the drawer when its server page registers it without inputs. */
type ConnectorDetailOverlayProps = {
    readonly items?: ReadonlyArray<Connection>
    /** Agent id -> name, for the "used by" line of each row. */
    readonly agentNames?: Readonly<Record<string, string>>
    readonly agents?: ReadonlyArray<AgentOption>
    readonly localOnly?: boolean
    readonly ownerEmail?: string
    /** The workspace owner adds, changes and removes connections; others read. */
    readonly canManage?: boolean
}

const STATUS_KEYS = { official: "statusOfficial", early: "statusEarly", soon: "statusSoon" } as const
const renderAddButton = (props: ComponentProps<typeof ConnectionAddButton>) => <ConnectionAddButton {...props} />
const renderAttention = (props: ComponentProps<typeof ConnectionAttention>) => <ConnectionAttention {...props} />
const renderLibrary = (props: ComponentProps<typeof ConnectionLibrary>) => <ConnectionLibrary {...props} />
const renderRow = (props: ComponentProps<typeof ConnectionRow>) => <ConnectionRow {...props} />
const renderViewTabs = (props: ComponentProps<typeof ConnectionViewTabs>) => <ConnectionViewTabs {...props} />

/** The server page registers the URL-selected drawers as rendered nodes. */
interface ConnectionsOverlayHostProps {
    readonly candidate: ReactNode
    readonly tab?: string | undefined
}

/** Mount the connection drawers only when the overview has a readable, loaded workspace. */
export const ConnectionsOverlayHost = (props: ConnectionsOverlayHostProps) => {
    const t = useTranslations("connections")
    const { activeWorkspaceId } = useActiveWorkspace()
    const workspaces = useWorkspaceCards()
    const user = useQueryAuthUserSwr()
    const data = useConnectionsData()
    const role = workspaces.cards.find((card) => card.id === activeWorkspaceId)?.role
    const manager = role === "owner" || role === "manager"
    const items = data.items
    const agentNames = data.agentNames
    const live = liveConnections(items)
    const attention = attentionConnections(items)
    const first = attention[0]
    const showsLibrary = props.tab === "library" || (props.tab !== "connected" && live.length === 0)
    const groups = connectionGroups(items, agentNames, t)
    const isLoading = workspaces.status === "loading" || (manager && data.isLoading)
    const mode = detailModeOf({ isLoading, manager, failed: data.failed })
    const gateway = useMcpGatewayView(mode === "ready" && manager)
    return (
        <>
            <ConnectionsOverview
                props={{
                    mode,
                    words: {
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
                    },
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
                renderAddButton={renderAddButton}
                renderAttention={renderAttention}
                renderLibrary={renderLibrary}
                renderRow={renderRow}
                renderViewTabs={renderViewTabs}
            />
            {gateway.isShown && (
                <McpGatewayRegion
                    label={gateway.label}
                    isLoading={gateway.isLoading}
                    isFailed={gateway.isFailed}
                    view={gateway.view}
                    failure={gateway.failure}
                    onRetry={gateway.onRetry}
                />
            )}
            {gateway.isShown && !gateway.isLoading && !gateway.isFailed && (
                <McpConnectorForms props={gateway.forms} on={gateway.on} />
            )}
            <OverlayHost active={mode === "ready"} candidate={props.candidate} />
        </>
    )
}

/** The connector detail drawer; the URL says which connector is open. */
export const ConnectorDetailOverlay = (props: ConnectorDetailOverlayProps) => {
    const t = useTranslations("connections")
    const params = useSearchParams()
    const overlays = useConnectionOverlays()
    const data = useConnectionsData()
    const user = useQueryAuthUserSwr()
    const { activeWorkspaceId } = useActiveWorkspace()
    const workspaces = useWorkspaceCards()
    const role = workspaces.cards.find((card) => card.id === activeWorkspaceId)?.role
    const items = props.items ?? data.items
    const agentNames = props.agentNames ?? data.agentNames

    const id = params.get(URL_PARAMS.detail)
    const found = id === null ? undefined : entryById(id)
    const provider = found?.provider
    const rows = provider === undefined ? [] : sortRows(items.filter((item) => item.provider === provider))
    const logo = found?.logo ?? (provider === undefined ? undefined : PROVIDER_LOGO[provider])
    const entry: DetailEntry | null =
        found === undefined
            ? null
            : {
                  id: found.id,
                  name: t(catalogKey(found, "name")),
                  category: t(`cat_${found.category}`),
                  blurb: t(catalogKey(found, "blurb")),
                  brings: t(catalogKey(found, "brings")),
                  audience: found.audience.map((audience) => t(`aud_${audience}`)).join(", "),
                  statusLabel: t(STATUS_KEYS[found.status]),
                  isOfficial: found.status === "official",
                  glyph: found.glyph,
                  ...(logo === undefined ? {} : { logo }),
                  ...(provider === undefined ? {} : { provider }),
              }

    return (
        <ConnectorDetailOverlayBase
            props={{
                entry,
                words: {
                    closeLabel: t("close"),
                    brings: t("detailBrings"),
                    audience: t("detailFor"),
                    yours: t("detailYours"),
                    yoursFact: t("connectionCount", { count: rows.length }),
                    none: t("detailNone"),
                    add: t("detailAdd"),
                    soon: t("detailSoon"),
                    ownerOnly: t("ownerOnly"),
                },
                rows: detailRowsOf(rows, agentNames),
                agents: props.agents ?? data.activeAgents,
                localOnly: props.localOnly ?? isLocalOnly(webSiteOrigin()),
                ownerEmail: props.ownerEmail ?? user.data?.email ?? "",
                canManage: props.canManage ?? role === "owner",
            }}
            on={{ close: overlays.closeDetail, add: (target) => overlays.openWizard(target) }}
        />
    )
}
