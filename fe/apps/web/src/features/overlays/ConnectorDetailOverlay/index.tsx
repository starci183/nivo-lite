"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import type { ComponentProps, ReactNode } from "react"
import { ConnectionAttention } from "@/components/blocks/ConnectionAttention"
import { ConnectionLibrary } from "@/components/blocks/ConnectionLibrary"
import { ConnectionRow } from "@/components/blocks/ConnectionRow"
import { ConnectionsOverview, OverlayHost } from "@/components/blocks/ConnectionsOverview"
import type { ConnectionsBoard } from "@/components/blocks/ConnectionsOverview"
import { McpGatewaySection } from "@/components/blocks/McpGatewaySection"
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
    useConnectionsRole,
    boardSlotOf,
} from "@/hooks/connections"
import { webSiteOrigin } from "@/modules/config"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import type { AgentOption, Connection } from "@/modules/types"
import { ConnectorDetailOverlayBase, detailRowsOf } from "./component"
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

const renderAttention = (props: ComponentProps<typeof ConnectionAttention>) => <ConnectionAttention {...props} />
const renderLibrary = (props: ComponentProps<typeof ConnectionLibrary>) => <ConnectionLibrary {...props} />
const renderRow = (props: ComponentProps<typeof ConnectionRow>) => <ConnectionRow {...props} />
const RenderGateway = (props: ComponentProps<typeof McpGatewaySection>) => <McpGatewaySection {...props} />
const STATUS_KEYS = { official: "statusOfficial", early: "statusEarly", soon: "statusSoon" } as const

/** The server page registers the URL-selected drawers as rendered nodes. */
interface ConnectionsOverlayHostProps {
    readonly candidate: ReactNode
    readonly tab?: string | undefined
}

/** Mount the connection drawers only when the overview has a readable, loaded workspace. */
export const ConnectionsOverlayHost = (props: ConnectionsOverlayHostProps) => {
    const t = useTranslations("connections")
    const slotLabelsOf = useSlotLabels()
    const { role, isLoading: isRoleLoading } = useConnectionsRole()
    // The signed-in person only prefills the SMTP test recipient: the board never waits on it.
    const user = slotOfSwr(useQueryAuthUserSwr())
    const data = useConnectionsData()
    const manager = role === "owner" || role === "manager"
    const live = liveConnections(data.items)
    const attention = attentionConnections(data.items)
    const showsLibrary = props.tab === "library" || (props.tab !== "connected" && live.length === 0)
    const namesOf = (connection: Connection) =>
        connection.agentIds.map((id) => data.agentNames[id]).filter((name): name is string => name !== undefined)
    const board: ConnectionsBoard = {
        view: showsLibrary ? "library" : "connected",
        ownerEmail: user.items?.email ?? "",
        canManage: role === "owner",
        localOnly: isLocalOnly(webSiteOrigin()),
        items: data.items,
        agents: data.activeAgents,
        agentNames: data.agentNames,
        liveCount: live.length,
        attentions: attention.map((connection) => ({ connection, agentNames: namesOf(connection) })),
        rows: sortRows(live).map((connection) => ({ connection, agentNames: namesOf(connection) })),
    }
    const slot = boardSlotOf(
        {
            isLoading: isRoleLoading || (manager && data.isLoading),
            isManager: manager,
            isFailed: data.failed,
        },
        board,
    )
    const isReady = slot.items !== undefined
    return (
        <>
            <ConnectionsOverview
                props={{
                    words: {
                        ownerOnly: t("ownerOnly"),
                        emptyTitle: t("connectedEmpty"),
                        emptyHint: t("connectedEmptyHint"),
                        automationsLink: t("automationsLink"),
                        automationsHref: CONNECTION_ROUTES.automations,
                        backLabel: t("crumbHome"),
                        backHref: CONNECTION_ROUTES.dashboard,
                        inUseTitle: t("inUseTitle"),
                        inUseOrder: t("inUseOrder"),
                    },
                    board: slot,
                    slotLabels: slotLabelsOf(t("connectedEmpty")),
                    placeholderView: props.tab === "library" ? "library" : "connected",
                    gateway: <RenderGateway isEnabled={isReady && manager} />,
                }}
                on={{ retry: data.retry }}
                renderAttention={renderAttention}
                renderLibrary={renderLibrary}
                renderRow={renderRow}
            />
            <OverlayHost active={isReady} candidate={props.candidate} />
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
    const { role } = useConnectionsRole()
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
