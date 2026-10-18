"use client"

import { useAgentDashboardConnections } from "./useAgentDashboardConnections"
import { decisionsHref } from "@/hooks/decisions"
import { useModuleName, type ModuleKey } from "@/hooks/installations"
import { agentChatHref, KNOWLEDGE_ROUTES } from "@/modules/routes"
import type { BadgeTone } from "@starci/grammar/common"
import { useFormatter, useTranslations } from "next-intl"
import { PENDING_DASHBOARD, type AgentDashboardView, type DashboardRow } from "./agentDashboard.shared"
import { useAgentDashboard } from "./useAgentDashboard"

/** One tab of the frame as the strip names it. */
interface FrameTab {
    readonly id: string
    readonly label: string
}

/** What the frame hands the hook: the module, its instance and the pieces the module brings itself. */
interface AgentDashboardFrameInput {
    readonly module: ModuleKey
    readonly installationId: string | null
    /** The module brings its own page command: the default "Talk to the agent" is not offered. */
    readonly hasOwnCommand: boolean
    /** The module brings its own gaps card: the built-in one is not offered. */
    readonly hasOwnGaps: boolean
}

/** The words and figures of the shared anatomy of an agent workbench: the dashboard of the module read in the browser, worded for the frame. */
export const useAgentDashboardFrame = (input: AgentDashboardFrameInput) => {
    const t = useTranslations("agentDashboard")
    const g = useTranslations("governance")
    const format = useFormatter()
    const moduleName = useModuleName(input.module)
    const { slot, reload } = useAgentDashboard(input.module, input.installationId ?? null)
    const dashboard = slot.items ?? PENDING_DASHBOARD
    const isDashboardLoading = slot.isLoading === true
    const connections = useAgentDashboardConnections(dashboard)
    const agent = dashboard.agent

    const whenOf = (iso: string | null): string =>
        iso === null
            ? ""
            : format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    const actionOf = (action: string): string => (g.has(`action_${action}`) ? g(`action_${action}`) : "")
    const rowOf = (item: DashboardRow) => ({
        id: item.id,
        title: item.title,
        description: [item.customer, actionOf(item.action), whenOf(item.at)].filter(Boolean).join(" · "),
        href: item.href,
    })
    const isFailed = slot.isError === true
    const isInternal = dashboard.knowledge.audience === "internal"
    const gaps = dashboard.knowledge.gaps

    const hasOwnCommand = input.hasOwnCommand
    const view = {
        isHeadLoading: isDashboardLoading,
        failure: { title: t("regionFailed"), description: t("regionFailedText"), retryLabel: t("retry") },
        waitingLabel: t("waitingTitle"),
        waitingFailed: isFailed || dashboard.waiting.isFailed,
        waiting: {
            count: dashboard.waiting.total > 0 ? String(dashboard.waiting.total) : null,
            rows: dashboard.waiting.items.map(rowOf),
            openLabel: t("waitingOpen"),
            more:
                dashboard.waiting.total > dashboard.waiting.items.length
                    ? t("waitingMore", { n: dashboard.waiting.total - dashboard.waiting.items.length })
                    : null,
            emptyMessage: t("waitingEmpty"),
            emptyDescription: t("waitingEmptyBody"),
        },
        doneLabel: t("doneTitle"),
        doneFailed: isFailed || dashboard.done.isFailed,
        done: {
            count: t("doneCount", { n: dashboard.done.count }),
            logLabel: t("doneLog"),
            logHref: decisionsHref("policy", input.module),
            rows: dashboard.done.items.map(rowOf),
            emptyMessage: t("doneEmpty"),
            emptyDescription: t("doneEmptyBody"),
        },
        connectionsLabel: t("connTitle"),
        connectionsFailed: isFailed || dashboard.connections.isFailed,
        connections,
        knowledgeLabel: t("knowTitle"),
        knowledgeFailed: isFailed || dashboard.knowledge.isFailed,
        knowledge: knowledgeOf(t, isInternal, dashboard, gaps, input, whenOf),
    }
    const mode: { readonly label: string; readonly tone: BadgeTone } | null =
        agent === null
            ? null
            : {
                  label: agent.mode === "autopilot" ? t("modeAutopilot") : t("modeAssist"),
                  tone: agent.mode === "autopilot" ? "success" : "accent",
              }
    const head = {
        title: agent?.name || moduleName,
        isHeadLoading: isDashboardLoading,
        mode,
        chat: agent === null || hasOwnCommand ? null : { label: t("commandChat"), href: agentChatHref(agent.id) },
    }
    /** The label of a tab; the waiting tab carries the number of decisions waiting once there are any. */
    const tabLabel = (tab: FrameTab, waitingTab: string | undefined): string =>
        tab.id === waitingTab && dashboard.waiting.total > 0 ? `${tab.label} (${dashboard.waiting.total})` : tab.label
    return { head, view, tabsLabel: t("tabsLabel"), tabLabel, reload }
}

const knowledgeOf = (
    t: ReturnType<typeof useTranslations<"agentDashboard">>,
    isInternal: boolean,
    dashboard: AgentDashboardView,
    gaps: {
        readonly openCount: number
        readonly items: ReadonlyArray<{
            readonly id: string
            readonly question: string
            readonly count: number
            readonly lastSeenAt: string
        }>
    } | null,
    input: AgentDashboardFrameInput,
    whenOf: (iso: string | null) => string,
) => {
    return {
        openLabel: t("knowOpen"),
        openHref: KNOWLEDGE_ROUTES.library,
        footer: isInternal ? t("knowAudienceInternal") : t("knowAudienceCustomer"),
        publicTitle: t("knowPublic"),
        publicDescription: t("knowCounts", {
            docs: dashboard.knowledge.documents.public,
            facts: dashboard.knowledge.facts.public,
        }),
        internalTitle: t("knowInternal"),
        internalDescription: isInternal
            ? [
                  t("knowCounts", {
                      docs: dashboard.knowledge.documents.internal,
                      facts: dashboard.knowledge.facts.internal,
                  }),
                  dashboard.knowledge.facts.restricted > 0
                      ? t("knowRestricted", { n: dashboard.knowledge.facts.restricted })
                      : "",
              ]
                  .filter(Boolean)
                  .join(" \u00b7 ")
            : t("knowInternalOff"),
        gaps:
            gaps && !input.hasOwnGaps
                ? {
                      label: t("gapsTitle"),
                      count: gaps.openCount > 0 ? String(gaps.openCount) : null,
                      openLabel: t("gapsOpen"),
                      openHref: KNOWLEDGE_ROUTES.library,
                      rows: gaps.items.map((gap) => ({
                          id: gap.id,
                          title: gap.question,
                          description: whenOf(gap.lastSeenAt),
                          asked: t("gapAsked", { n: gap.count }),
                      })),
                      emptyMessage: t("gapsEmpty"),
                      emptyDescription: t("gapsEmptyBody"),
                  }
                : null,
    }
}
