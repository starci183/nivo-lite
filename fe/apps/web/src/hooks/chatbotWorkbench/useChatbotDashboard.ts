import { useQueryChatbotAgentDashboardSwr } from "@/hooks/swr"
import type { AgentDashboardData, ConnectionItem, DashboardItem } from "@/lib/agent-dashboard-shared"
import { agentHref } from "@/modules/installations"
import type { ChatbotOverview } from "@/modules/types"

type AgentDashboardWire = NonNullable<ReturnType<typeof useQueryChatbotAgentDashboardSwr>["data"]>
type AgentDashboardItemWire = NonNullable<AgentDashboardWire["done"]["data"]>["items"][number]

const itemOf = (item: AgentDashboardItemWire): DashboardItem => ({
    id: item.id,
    title: item.title,
    description: item.customer,
    at: item.at,
    href: item.resultHref ?? "/decisions",
})

const purposeOf = (purpose: string): ConnectionItem["purpose"] => {
    if (
        purpose === "inbound_chat" ||
        purpose === "outbound_chat" ||
        purpose === "bank_feed" ||
        purpose === "tool" ||
        purpose === "lead_source"
    )
        return purpose
    return "data_source"
}

const dashboardOf = (
    data: AgentDashboardWire,
    overview: ChatbotOverview | undefined,
    installationId: string | undefined,
): AgentDashboardData => ({
    agent:
        data.agent == null ? null : { ...data.agent, mode: data.agent.mode === "autopilot" ? "autopilot" : "assist" },
    // The overview supplies conversation identities for inbox links; the shared dashboard's rows carry work-item identities.
    waiting:
        !data.waiting.ok || data.waiting.data == null || overview === undefined
            ? { ok: false }
            : {
                  ok: true,
                  data: {
                      total: overview.metrics.waiting,
                      items: overview.conversations
                          .filter((item) => item.waiting)
                          .slice(0, 5)
                          .map((item) => ({
                              id: item.id,
                              title: item.name,
                              description: item.lastText,
                              at: item.lastAt,
                              href: agentHref(
                                  "chatbot",
                                  installationId ?? null,
                                  "workbench",
                                  new URLSearchParams({ focus: item.id }).toString(),
                              ),
                          })),
                  },
              },
    done:
        !data.done.ok || data.done.data == null
            ? { ok: false }
            : {
                  ok: true,
                  data: { count: data.done.data.count, items: data.done.data.items.map(itemOf) },
              },
    connections:
        !data.connections.ok || data.connections.data == null
            ? { ok: false }
            : {
                  ok: true,
                  data: data.connections.data.flatMap((connection) =>
                      connection == null
                          ? []
                          : [
                                {
                                    id: connection.id,
                                    name: connection.name,
                                    providerLabel: connection.provider,
                                    access:
                                        connection.access === "read" || connection.access === "auto"
                                            ? connection.access
                                            : "ask",
                                    status:
                                        connection.status === "connected" || connection.status === "error"
                                            ? connection.status
                                            : "pending",
                                    purpose: purposeOf(connection.purpose),
                                },
                            ],
                  ),
              },
    knowledge:
        !data.knowledge.ok || data.knowledge.data == null
            ? { ok: false }
            : {
                  ok: true,
                  data: {
                      ...data.knowledge.data,
                      audience: data.knowledge.data.audience === "customer" ? "customer" : "internal",
                      gaps: data.knowledge.data.gaps ?? null,
                  },
              },
})

/** Adapts the shared GraphQL dashboard to the existing workbench frame without server data loaders. */
export const useChatbotDashboard = (
    workspaceId: string | undefined,
    installationId: string | undefined,
    overview: ChatbotOverview | undefined,
) => {
    const query = useQueryChatbotAgentDashboardSwr(workspaceId, installationId)
    return { ...query, data: query.data === undefined ? undefined : dashboardOf(query.data, overview, installationId) }
}
