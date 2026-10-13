"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { catalogKey, entryById } from "@/hooks/connection-catalog"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import { sortRows, URL_PARAMS, useConnectionOverlays } from "@/hooks/connections"
import type { AgentOption, Connection } from "@/modules/types"
import { ConnectorDetailOverlayBase } from "./component"
import type { DetailEntry } from "./component"

/** What the page that read the workspace hands the connector detail drawer. */
type ConnectorDetailOverlayProps = {
    readonly items: ReadonlyArray<Connection>
    /** Agent id -> name, for the "used by" line of each row. */
    readonly agentNames: Readonly<Record<string, string>>
    readonly agents: ReadonlyArray<AgentOption>
    readonly localOnly: boolean
    readonly ownerEmail: string
    /** The workspace owner adds, changes and removes connections; others read. */
    readonly canManage: boolean
}

const STATUS_KEYS = { official: "statusOfficial", early: "statusEarly", soon: "statusSoon" } as const

/** The connector detail drawer; the URL says which connector is open. */
export const ConnectorDetailOverlay = (props: ConnectorDetailOverlayProps) => {
    const t = useTranslations("connections")
    const params = useSearchParams()
    const overlays = useConnectionOverlays()

    const id = params.get(URL_PARAMS.detail)
    const found = id === null ? undefined : entryById(id)
    const provider = found?.provider
    const rows = provider === undefined ? [] : sortRows(props.items.filter((item) => item.provider === provider))
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
                rows: rows.map((connection) => ({
                    connection,
                    agentNames: connection.agentIds
                        .map((agentId) => props.agentNames[agentId])
                        .filter((name): name is string => name !== undefined),
                })),
                agents: props.agents,
                localOnly: props.localOnly,
                ownerEmail: props.ownerEmail,
                canManage: props.canManage,
            }}
            on={{ close: overlays.closeDetail, add: (target) => overlays.openWizard(target) }}
        />
    )
}
