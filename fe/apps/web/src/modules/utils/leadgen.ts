import type { AgentDashboardData, ConnectionItem, DashboardItem } from "@/lib/agent-dashboard-shared"
import { workbenchHref } from "@/lib/agent-dashboard-shared"
import type { WorkStatus } from "@/lib/flow-types"
import type { QueryLeadGenAgentDashboardResponse } from "@/modules/api/graphql/queries/query-lead-gen-agent-dashboard"
import type { QueryLeadGenWorkbenchResponse } from "@/modules/api/graphql/queries/query-lead-gen-workbench"
import type { LeadGenWorkbenchData, LeadOrigin, LeadPlatform, LeadScore, LeadSourceKind } from "@/modules/types"

const platformOf = (value: string): LeadPlatform => (value === "facebook" || value === "instagram" ? value : "other")
const kindOf = (value: string): LeadSourceKind =>
    value === "lead_ad" || value === "dm" || value === "comment" || value === "mention" ? value : "other"
const scoreOf = (value: string | null | undefined): LeadScore | null =>
    value === "hot" || value === "warm" || value === "cold" ? value : null
const workStatusOf = (value: string | null | undefined): WorkStatus | null =>
    value === "queued" || value === "done" || value === "waiting_decision" || value === "rejected" || value === "failed"
        ? value
        : null

const originOf = (
    origin: QueryLeadGenWorkbenchResponse["leadGenWorkbench"]["sources"][number]["origin"],
): LeadOrigin => ({
    platform: platformOf(origin.platform),
    kind: kindOf(origin.kind),
    refKind: origin.refKind === "post" || origin.refKind === "ad" || origin.refKind === "form" ? origin.refKind : null,
    refId: origin.refId ?? null,
    refLabel: origin.refLabel ?? null,
})

/** Normalizes optional GraphQL values and open string fields for the existing workbench views. */
export const toLeadGenWorkbenchData = (
    data: QueryLeadGenWorkbenchResponse["leadGenWorkbench"],
): LeadGenWorkbenchData => ({
    metrics: { ...data.metrics, firstReplyP50Min: data.metrics.firstReplyP50Min ?? null },
    leads: data.leads.map((row) => ({ ...row, score: scoreOf(row.score), origin: originOf(row.origin) })),
    leadsHidden: data.leadsHidden,
    sources: data.sources.map((row) => ({ ...row, origin: originOf(row.origin) })),
    comments: data.comments.map((row) => ({
        ...row,
        platform: platformOf(row.platform),
        refLabel: row.refLabel ?? null,
    })),
    handoffs: data.handoffs.map((row) => ({ ...row, score: scoreOf(row.score), classify: workStatusOf(row.classify) })),
})

const connectionOf = (
    connection: NonNullable<QueryLeadGenAgentDashboardResponse["agentDashboard"]["connections"]["data"]>[number],
): ConnectionItem => ({
    id: connection.id,
    name: connection.name,
    providerLabel: connection.provider,
    status: connection.status === "connected" || connection.status === "error" ? connection.status : "pending",
    access: connection.access === "ask" || connection.access === "auto" ? connection.access : "read",
    purpose:
        connection.purpose === "outbound_chat" ||
        connection.purpose === "bank_feed" ||
        connection.purpose === "data_source" ||
        connection.purpose === "tool" ||
        connection.purpose === "lead_source"
            ? connection.purpose
            : "inbound_chat",
})

const dashboardItemOf = (
    item: NonNullable<QueryLeadGenAgentDashboardResponse["agentDashboard"]["waiting"]["data"]>["items"][number],
    href: string,
): DashboardItem => ({
    id: item.id,
    title: item.title,
    description: item.customer || undefined,
    at: item.at,
    href,
})

/** Adapts the shared dashboard response and points public-comment decisions into this instance's Comments tab. */
export const toLeadGenAgentDashboard = (
    dashboard: QueryLeadGenAgentDashboardResponse["agentDashboard"],
    installationId: string | null,
): AgentDashboardData => {
    const { agent, waiting, done, connections, knowledge } = dashboard
    return {
        agent: agent
            ? { id: agent.id, name: agent.name, mode: agent.mode === "autopilot" ? "autopilot" : "assist" }
            : null,
        waiting:
            waiting.ok && waiting.data
                ? {
                      ok: true,
                      data: {
                          total: waiting.data.total,
                          items: waiting.data.items.map((item) =>
                              dashboardItemOf(
                                  item,
                                  workbenchHref("lead_gen", { tab: "comments", focus: item.id, installationId }),
                              ),
                          ),
                      },
                  }
                : { ok: false },
        done:
            done.ok && done.data
                ? {
                      ok: true,
                      data: {
                          count: done.data.count,
                          items: done.data.items.map((item) =>
                              dashboardItemOf(
                                  item,
                                  item.resultHref ||
                                      (item.leadId ? `/leads/${item.leadId}` : "/decisions?kind=policy&dept=lead_gen"),
                              ),
                          ),
                      },
                  }
                : { ok: false },
        connections:
            connections.ok && connections.data
                ? {
                      ok: true,
                      data: connections.data.map(connectionOf),
                  }
                : { ok: false },
        knowledge:
            knowledge.ok && knowledge.data
                ? {
                      ok: true,
                      data: {
                          audience: knowledge.data.audience === "internal" ? "internal" : "customer",
                          documents: knowledge.data.documents,
                          facts: knowledge.data.facts,
                          gaps: knowledge.data.gaps ?? null,
                      },
                  }
                : { ok: false },
    }
}
