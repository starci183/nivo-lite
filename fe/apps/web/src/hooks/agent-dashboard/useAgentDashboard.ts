import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { isAccess } from "@/hooks/connection-access"
import { isProvider, providerKey } from "@/hooks/connection-providers"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useQueryAgentDashboardSwr } from "@/hooks/swr/api/graphql/queries/useQueryAgentDashboardSwr"
import type { AgentDashboardView, DashboardRow } from "@/modules/types"
import { workbenchPath } from "@/modules/installations"
import type { AgentDashboardItemType } from "@/modules/api"
import type { ModuleKey } from "@/modules/catalog"
import type { Purpose } from "@/modules/types"

const purposeOf = (value: string): Purpose => {
    switch (value) {
        case "inbound_chat":
        case "outbound_chat":
        case "bank_feed":
        case "tool":
        case "lead_source":
            return value
        default:
            return "data_source"
    }
}

/** The three states the dashboard draws; anything else is still pending. */
const connectionStatusOf = (status: string): "connected" | "error" | "pending" =>
    status === "connected" || status === "error" ? status : "pending"

/** Maps the generated dashboard payload into the shared frame's view data. */
export const useAgentDashboard = (module: ModuleKey, installationId?: string | null) => {
    const tGovernance = useTranslations("governance")
    const tConnections = useTranslations("connections")
    const { activeWorkspaceId } = useActiveWorkspace()
    const query = useQueryAgentDashboardSwr(activeWorkspaceId, { module, installationId })
    const data = useMemo<AgentDashboardView | undefined>(() => {
        const dashboard = query.data
        if (!dashboard) return undefined
        const actionLabel = (action: string): string => {
            const key = `action_${action}`
            return tGovernance.has(key) ? tGovernance(key) : action
        }
        const itemOf = (item: AgentDashboardItemType, waiting: boolean): DashboardRow => ({
            id: item.id,
            title: item.title || actionLabel(item.action),
            description: [item.customer, actionLabel(item.action)].filter(Boolean).join(" · ") || undefined,
            at: item.at,
            href: waiting
                ? workbenchPath(module, {
                      tab: module === "content" ? "queue" : undefined,
                      focus: item.id,
                      installationId,
                  })
                : item.resultHref || (item.leadId ? `/leads/${item.leadId}` : `/decisions?kind=policy&dept=${module}`),
        })
        return {
            agent: dashboard.agent
                ? { ...dashboard.agent, mode: dashboard.agent.mode === "autopilot" ? "autopilot" : "assist" }
                : null,
            waiting:
                dashboard.waiting.ok && dashboard.waiting.data
                    ? {
                          status: "ready",
                          data: {
                              total: dashboard.waiting.data.total,
                              items: dashboard.waiting.data.items.map((item) => itemOf(item, true)),
                          },
                      }
                    : { status: "failed" },
            done:
                dashboard.done.ok && dashboard.done.data
                    ? {
                          status: "ready",
                          data: {
                              count: dashboard.done.data.count,
                              items: dashboard.done.data.items.map((item) => itemOf(item, false)),
                          },
                      }
                    : { status: "failed" },
            connections:
                dashboard.connections.ok && dashboard.connections.data
                    ? {
                          status: "ready",
                          data: dashboard.connections.data.map((connection) => ({
                              id: connection.id,
                              name: connection.name,
                              providerLabel: isProvider(connection.provider)
                                  ? tConnections(providerKey(connection.provider, "title"))
                                  : connection.provider,
                              status: connectionStatusOf(connection.status),
                              access: isAccess(connection.access) ? connection.access : "read",
                              purpose: purposeOf(connection.purpose),
                          })),
                      }
                    : { status: "failed" },
            knowledge:
                dashboard.knowledge.ok && dashboard.knowledge.data
                    ? {
                          status: "ready",
                          data: {
                              audience: dashboard.knowledge.data.audience === "internal" ? "internal" : "customer",
                              documents: dashboard.knowledge.data.documents,
                              facts: dashboard.knowledge.data.facts,
                              gaps: dashboard.knowledge.data.gaps ?? null,
                          },
                      }
                    : { status: "failed" },
        }
    }, [query.data, module, installationId, tGovernance, tConnections])
    return { ...query, data }
}
