"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal, useConnectionsData } from "@/hooks/connections"
import { useConnectionGrantsBand } from "@/hooks/connectionsPanes"
import type { Provider } from "@/modules/types"
import { ConnectionAgentsBase } from "./component"

/** The connection whose agents the region shows: by its id, or, for a workspace's single connection of a provider (Drive), by provider. */
interface ConnectionAgentsProps {
    readonly connectionId?: string
    readonly provider?: Provider
    /** The overview shows the region only once an agent works through the connection. */
    readonly isHiddenWhenEmpty?: boolean
}

/**
 * The agents region of every connection page: the agents bound to the connection, unbinding one and binding another (which accounts an agent holds is the
 * agent's rights tab). Nothing for a member who may not read the page.
 */
export const ConnectionAgents = (props: ConnectionAgentsProps) => {
    const t = useTranslations("connections")
    const data = useConnectionsData()
    const byProvider = data.items.find((item) => item.provider === props.provider)?.id
    const band = useConnectionGrantsBand(props.connectionId ?? byProvider ?? "")
    const refusal = useConnectionRefusal()
    const hasRows = "items" in band.props.slot && band.props.slot.items.rows.length > 0
    if (refusal !== undefined || (props.isHiddenWhenEmpty === true && !hasRows)) return null
    return (
        <ConnectionAgentsBase
            props={{
                ...band.props,
                title: t("pageAgentsTitle"),
                assignLabel: t("assignAgent"),
                emptyMessage: t("pageAgentsEmpty"),
                isCard: true,
            }}
            on={band.on}
        />
    )
}
