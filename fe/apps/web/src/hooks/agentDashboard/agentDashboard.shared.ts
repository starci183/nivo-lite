import type { AgentDashboardData, DashboardItem } from "@/lib/agent-dashboard-shared"
import type { AgentDashboardItemType, AgentDashboardType } from "@/modules/api"

/** How the dashboard words its links and labels: the caller owns the translations and the routes. */
export interface AgentDashboardViewOptions {
    readonly decisionHref: (item: AgentDashboardItemType) => string
    readonly completedHref: (item: AgentDashboardItemType) => string
    readonly actionLabel: (action: string) => string
    readonly providerLabel: (provider: string) => string
}

const dashboardItemOf = (
    item: AgentDashboardItemType,
    href: string,
    actionLabel: (action: string) => string,
): DashboardItem => ({
    id: item.id,
    title: item.title || actionLabel(item.action),
    description: [item.customer, actionLabel(item.action)].filter(Boolean).join(" · ") || undefined,
    at: item.at,
    href,
})

const connectionStatusOf = (status: string): "connected" | "error" | "pending" => {
    if (status === "connected" || status === "error") return status
    return "pending"
}

/** Adapts the generated dashboard result to the existing shared frame's presentation model. */
export const agentDashboardViewOf = (
    data: AgentDashboardType,
    options: AgentDashboardViewOptions,
): AgentDashboardData => {
    const waiting = data.waiting.data
    const done = data.done.data
    const connections = data.connections.data
    const knowledge = data.knowledge.data
    return {
        agent: data.agent ? { ...data.agent, mode: data.agent.mode === "autopilot" ? "autopilot" : "assist" } : null,
        waiting:
            data.waiting.ok && waiting
                ? {
                      ok: true,
                      data: {
                          total: waiting.total,
                          items: waiting.items.map((item) =>
                              dashboardItemOf(item, options.decisionHref(item), options.actionLabel),
                          ),
                      },
                  }
                : { ok: false },
        done:
            data.done.ok && done
                ? {
                      ok: true,
                      data: {
                          count: done.count,
                          items: done.items.map((item) =>
                              dashboardItemOf(item, options.completedHref(item), options.actionLabel),
                          ),
                      },
                  }
                : { ok: false },
        connections:
            data.connections.ok && connections
                ? {
                      ok: true,
                      data: connections.flatMap((connection) => {
                          const { access, purpose } = connection
                          if (access !== "read" && access !== "ask" && access !== "auto") return []
                          if (
                              purpose !== "inbound_chat" &&
                              purpose !== "outbound_chat" &&
                              purpose !== "bank_feed" &&
                              purpose !== "data_source" &&
                              purpose !== "tool" &&
                              purpose !== "lead_source"
                          )
                              return []
                          return [
                              {
                                  id: connection.id,
                                  name: connection.name,
                                  providerLabel: options.providerLabel(connection.provider),
                                  status: connectionStatusOf(connection.status),
                                  access,
                                  purpose,
                              },
                          ]
                      }),
                  }
                : { ok: false },
        knowledge:
            data.knowledge.ok && knowledge
                ? {
                      ok: true,
                      data: {
                          audience: knowledge.audience === "internal" ? "internal" : "customer",
                          documents: knowledge.documents,
                          facts: knowledge.facts,
                          gaps: knowledge.gaps ?? null,
                      },
                  }
                : { ok: false },
    }
}
