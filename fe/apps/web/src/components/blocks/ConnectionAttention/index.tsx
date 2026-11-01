"use client"

import { useTranslations } from "next-intl"
import { providerKey } from "@/hooks/connection-providers"
import { canReopen } from "@/hooks/connection-rows"
import { connectionPageHref, useConnectionOverlays } from "@/hooks/connections"
import { navigation } from "@/modules/i18n"
import type { Connection } from "@/modules/types"
import { ConnectionAttentionBase } from "./component"

/** What the page hands the attention banner. */
type ConnectionAttentionProps = {
    /** A connection that is unfinished or broken. */
    readonly connection: Connection
    /** The names of the agents that use it: the impact the banner names. */
    readonly agentNames: ReadonlyArray<string>
    readonly canManage: boolean
}

/** The banner naming one connection that needs a check and what it stops; its action goes to the connection's page, or reopens its wizard. */
export const ConnectionAttention = (props: ConnectionAttentionProps) => {
    const t = useTranslations("connections")
    const router = navigation.useRouter()
    const overlays = useConnectionOverlays()
    const { connection } = props
    const pageHref = connectionPageHref(connection)
    const description = [
        connection.status === "pending" ? t("attentionPending") : t("attentionError"),
        props.agentNames.length > 0 ? t("attentionImpact", { names: props.agentNames.join(", ") }) : "",
    ]
        .filter(Boolean)
        .join(" ")
    const canAct = props.canManage && (pageHref !== null || canReopen(connection.provider))
    return (
        <ConnectionAttentionBase
            props={{
                title: t("attentionTitle", {
                    name: connection.name,
                    provider: t(providerKey(connection.provider, "title")),
                }),
                description,
                ...(canAct ? { actionLabel: pageHref === null ? t("continue") : t("openPage") } : {}),
            }}
            on={{
                action: () =>
                    pageHref === null ? overlays.openWizard(connection.provider, connection.id) : router.push(pageHref),
            }}
        />
    )
}
