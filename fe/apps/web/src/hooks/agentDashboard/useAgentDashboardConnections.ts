"use client"

import { isProvider, providerKey } from "@/hooks/connection-providers"
import { AUTOMATION_ROUTES } from "@/modules/routes"
import type { BadgeTone } from "@starci/grammar/common"
import { useTranslations } from "next-intl"
import { type AgentDashboardView, type ConnectionState } from "./agentDashboard.shared"

const CONNECTION_TONE: Readonly<Record<ConnectionState, BadgeTone>> = {
    connected: "success",
    error: "danger",
    pending: "neutral",
}

/** Resolves connection status, purpose and access copy for the dashboard. */
export const useAgentDashboardConnections = (dashboard: AgentDashboardView) => {
    const t = useTranslations("agentDashboard")
    const tc = useTranslations("connections")
    return {
        manageLabel: t("connManage"),
        manageHref: AUTOMATION_ROUTES.connections,
        rows: dashboard.connections.items.map((connection) => {
            const purpose = t(`connPurpose_${connection.purpose}`)
            return {
                id: connection.id,
                name: connection.name,
                description: `${isProvider(connection.provider) ? tc(providerKey(connection.provider, "title")) : connection.provider} \u00b7 ${purpose}`,
                statusLabel: t(`connStatus_${connection.status}`),
                statusTone: CONNECTION_TONE[connection.status],
                accessLabel: t(`connAccess_${connection.access}`),
            }
        }),
        emptyMessage: t("connEmpty"),
        emptyDescription: t("connEmptyBody"),
    }
}
