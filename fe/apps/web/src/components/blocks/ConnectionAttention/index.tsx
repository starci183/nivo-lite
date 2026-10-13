"use client"

import { useTranslations } from "next-intl"
import { providerKey } from "@/hooks/connection-providers"
import { canReopen } from "@/hooks/connection-rows"
import { useConnectionOverlays } from "@/hooks/connections"
import type { Connection } from "@/modules/types"
import { ConnectionAttentionBase } from "./component"

/** What the page hands the attention banner. */
type ConnectionAttentionProps = {
    /** The first connection that is unfinished or broken. */
    readonly connection: Connection
    /** How many connections need attention in all. */
    readonly count: number
    readonly canManage: boolean
}

/** The banner naming the first connection that needs attention; its action reopens that connection's wizard. */
export const ConnectionAttention = (props: ConnectionAttentionProps) => {
    const t = useTranslations("connections")
    const overlays = useConnectionOverlays()
    const { connection } = props
    const description = [
        connection.status === "pending" ? t("attentionPending") : t("attentionError"),
        props.count > 1 ? t("attentionMore", { count: props.count - 1 }) : "",
    ]
        .filter(Boolean)
        .join(" ")
    return (
        <ConnectionAttentionBase
            props={{
                title: t("attentionTitle", {
                    name: connection.name,
                    provider: t(providerKey(connection.provider, "title")),
                }),
                description,
                ...(props.canManage && canReopen(connection.provider) ? { actionLabel: t("attentionAction") } : {}),
            }}
            on={{ action: () => overlays.openWizard(connection.provider, connection.id) }}
        />
    )
}
