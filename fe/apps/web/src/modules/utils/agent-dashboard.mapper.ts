import type { AgentDashboardItemType, AgentDashboardType } from "@/modules/api"
import type { AgentDashboardData, ConnectionItem, DashboardItem } from "@/lib/agent-dashboard-shared"
import { workbenchHref } from "@/lib/agent-dashboard-shared"
import type { ModuleKey } from "@/lib/modules-shared"

const connectionStatusOf = (status: string): ConnectionItem["status"] => {
    if (status === "connected") return "connected"
    if (status === "error") return "error"
    return "pending"
}

const accessOf = (access: string): ConnectionItem["access"] => {
    if (access === "auto") return "auto"
    if (access === "ask") return "ask"
    return "read"
}

const itemOf = (item: AgentDashboardItemType, module: ModuleKey, waiting: boolean): DashboardItem => ({
    id: item.id,
    title: item.title || item.action,
    description: item.customer || undefined,
    at: item.at,
    href: waiting
        ? workbenchHref(module, { tab: module === "accounting" ? "questions" : undefined, focus: item.id })
        : item.resultHref || (item.leadId ? `/leads/${item.leadId}` : `/decisions?kind=policy&dept=${module}`),
})

/** Maps generated dashboard facts into the shared frame's presentation model. */
export const agentDashboardOf = (data: AgentDashboardType, module: ModuleKey): AgentDashboardData => ({
    agent: data.agent ? { ...data.agent, mode: data.agent.mode === "autopilot" ? "autopilot" : "assist" } : null,
    waiting:
        data.waiting.ok && data.waiting.data
            ? {
                  ok: true,
                  data: {
                      total: data.waiting.data.total,
                      items: data.waiting.data.items.map((item) => itemOf(item, module, true)),
                  },
              }
            : { ok: false },
    done:
        data.done.ok && data.done.data
            ? {
                  ok: true,
                  data: {
                      count: data.done.data.count,
                      items: data.done.data.items.map((item) => itemOf(item, module, false)),
                  },
              }
            : { ok: false },
    connections:
        data.connections.ok && data.connections.data
            ? {
                  ok: true,
                  data: data.connections.data.map((item): ConnectionItem => ({
                      id: item.id,
                      name: item.name,
                      providerLabel: item.provider,
                      status: connectionStatusOf(item.status),
                      access: accessOf(item.access),
                      purpose:
                          item.purpose === "inbound_chat" ||
                          item.purpose === "outbound_chat" ||
                          item.purpose === "bank_feed" ||
                          item.purpose === "data_source" ||
                          item.purpose === "lead_source"
                              ? item.purpose
                              : "tool",
                  })),
              }
            : { ok: false },
    knowledge:
        data.knowledge.ok && data.knowledge.data
            ? {
                  ok: true,
                  data: {
                      ...data.knowledge.data,
                      audience: data.knowledge.data.audience === "customer" ? "customer" : "internal",
                      gaps: data.knowledge.data.gaps ?? null,
                  },
              }
            : { ok: false },
})
