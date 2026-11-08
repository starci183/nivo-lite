"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import type { ReactNode } from "react"
import { useQueryAuthUserSwr } from "@/hooks/auth"
import { catalogKey, entryById } from "@/hooks/connection-catalog"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import {
    isLocalOnly,
    mayConnect,
    sortRows,
    URL_PARAMS,
    useConnectionOverlays,
    useConnectionsData,
    useConnectionsRole,
} from "@/hooks/connections"
import { webSiteOrigin } from "@/modules/config"
import { slotOfReads } from "@/hooks/slot"
import type { AgentOption, Connection } from "@/modules/types"
import { ConnectorDetailOverlayBase, OverlayHost, detailRowsOf, type DetailEntry } from "./component"

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

/** The server page registers the URL-selected drawers as rendered nodes. */
interface ConnectionsOverlayHostProps {
    readonly candidate: ReactNode
}

/** Mount the connection drawers only when the workspace reads are in and the viewer may manage connections. */
export const ConnectionsOverlayHost = (props: ConnectionsOverlayHostProps) => {
    const access = useConnectionsRole()
    const data = useConnectionsData()
    const manager = access.role === "owner" || access.role === "manager"
    const slot = slotOfReads([access.read, ...data.reads], () => true)
    return <OverlayHost active={"items" in slot && manager} candidate={props.candidate} />
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
                  needs: provider === undefined ? "" : t(catalogKey(found, "needs")),
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
                    needs: t("detailNeeds"),
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
                canConnect: provider !== undefined && mayConnect(role, provider),
            }}
            on={{ close: overlays.closeDetail, add: (target) => overlays.openWizard(target) }}
        />
    )
}
