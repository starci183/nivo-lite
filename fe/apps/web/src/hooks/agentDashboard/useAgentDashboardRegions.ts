"use client"

import { decisionsHref } from "@/hooks/decisions"
import type { ModuleKey } from "@/hooks/installations"
import { useSlotLabels } from "@/hooks/slot"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"
import type { DataSlot } from "@/modules/types"
import { useFormatter, useTranslations } from "next-intl"
import { PENDING_DASHBOARD, type AgentDashboardView, type DashboardRow } from "./agentDashboard.shared"
import { useAgentDashboardConnections } from "./useAgentDashboardConnections"

/** What the regions need from the frame: the module, and whether the module brings its own gaps card. */
interface RegionsInput {
    readonly module: ModuleKey
    readonly hasOwnGaps: boolean
}

/** A blank list row: the placeholder of a region draws the same row as a ready one, as a skeleton. */
const PLACEHOLDER_ROW = { id: "placeholder", title: "-", description: "-", href: "" }

/** A row without a readable time shows no time: the formatter never sees an invalid date. */
const whenOfFormat =
    (format: ReturnType<typeof useFormatter>) =>
    (iso: string | null): string => {
        const at = iso === null ? Number.NaN : Date.parse(iso)
        return Number.isNaN(at)
            ? ""
            : format.dateTime(new Date(at), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    }

/**
 * The slot of one region of the dashboard: loading and failing with the whole read, failing alone when the server could not read
 * this region, else its view. A read that does not fetch stays as it is (empty).
 */
const regionSlotOf = <V>(
    slot: DataSlot<AgentDashboardView>,
    isRegionFailed: (dashboard: AgentDashboardView) => boolean,
    viewOf: (dashboard: AgentDashboardView) => V,
): DataSlot<V> => {
    const dashboard = slot.items
    if (dashboard === undefined) {
        return { isLoading: slot.isLoading, isForbidden: slot.isForbidden, isError: slot.isError }
    }
    return isRegionFailed(dashboard) ? { isError: true } : { items: viewOf(dashboard) }
}

/** The knowledge region: the lens of the agent and, when the reader may see it and the module has none of its own, the open gaps. */
const knowledgeOf = (
    t: ReturnType<typeof useTranslations<"agentDashboard">>,
    dashboard: AgentDashboardView,
    hasOwnGaps: boolean,
    whenOf: (iso: string | null) => string,
) => {
    const isInternal = dashboard.knowledge.audience === "internal"
    const gaps = dashboard.knowledge.gaps
    const restricted = dashboard.knowledge.facts.restricted
    const counts = (kind: "public" | "internal") =>
        t("knowCounts", { docs: dashboard.knowledge.documents[kind], facts: dashboard.knowledge.facts[kind] })
    return {
        openLabel: t("knowOpen"),
        openHref: KNOWLEDGE_ROUTES.library,
        footer: isInternal ? t("knowAudienceInternal") : t("knowAudienceCustomer"),
        publicTitle: t("knowPublic"),
        publicDescription: counts("public"),
        internalTitle: t("knowInternal"),
        internalDescription: isInternal
            ? [counts("internal"), restricted > 0 ? t("knowRestricted", { n: restricted }) : ""]
                  .filter(Boolean)
                  .join(" · ")
            : t("knowInternalOff"),
        gaps:
            gaps && !hasOwnGaps
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

/** The four common regions of an agent workbench (waiting, done, connections, knowledge): each one a slot, its same-shape placeholder and the words of its status. */
export const useAgentDashboardRegions = (slot: DataSlot<AgentDashboardView>, input: RegionsInput) => {
    const t = useTranslations("agentDashboard")
    const g = useTranslations("governance")
    const slotLabels = useSlotLabels()
    const whenOf = whenOfFormat(useFormatter())
    const connections = useAgentDashboardConnections(slot.items ?? PENDING_DASHBOARD)
    const actionOf = (action: string): string => (g.has(`action_${action}`) ? g(`action_${action}`) : "")
    const rowOf = (item: DashboardRow) => ({
        id: item.id,
        title: item.title,
        description: [item.customer, actionOf(item.action), whenOf(item.at)].filter(Boolean).join(" · "),
        href: item.href,
    })
    const waitingOf = (dashboard: AgentDashboardView) => ({
        count: dashboard.waiting.total > 0 ? String(dashboard.waiting.total) : null,
        rows: dashboard.waiting.items.map(rowOf),
        openLabel: t("waitingOpen"),
        more:
            dashboard.waiting.total > dashboard.waiting.items.length
                ? t("waitingMore", { n: dashboard.waiting.total - dashboard.waiting.items.length })
                : null,
        emptyMessage: t("waitingEmpty"),
        emptyDescription: t("waitingEmptyBody"),
    })
    const doneOf = (dashboard: AgentDashboardView) => ({
        count: t("doneCount", { n: dashboard.done.count }),
        logLabel: t("doneLog"),
        logHref: decisionsHref("policy", input.module),
        rows: dashboard.done.items.map(rowOf),
        emptyMessage: t("doneEmpty"),
        emptyDescription: t("doneEmptyBody"),
    })
    const knowledgeViewOf = (dashboard: AgentDashboardView) => knowledgeOf(t, dashboard, input.hasOwnGaps, whenOf)
    const blankConnection = {
        ...PLACEHOLDER_ROW,
        name: "-",
        statusLabel: "-",
        statusTone: "neutral" as const,
        accessLabel: "-",
    }
    return {
        waiting: {
            label: t("waitingTitle"),
            slot: regionSlotOf(slot, (dashboard) => dashboard.waiting.isFailed, waitingOf),
            placeholder: { ...waitingOf(PENDING_DASHBOARD), count: "0", rows: [PLACEHOLDER_ROW] },
            labels: slotLabels(t("waitingEmpty")),
        },
        done: {
            label: t("doneTitle"),
            slot: regionSlotOf(slot, (dashboard) => dashboard.done.isFailed, doneOf),
            placeholder: { ...doneOf(PENDING_DASHBOARD), rows: [PLACEHOLDER_ROW] },
            labels: slotLabels(t("doneEmpty")),
        },
        connections: {
            label: t("connTitle"),
            slot: regionSlotOf(
                slot,
                (dashboard) => dashboard.connections.isFailed,
                () => connections,
            ),
            placeholder: { ...connections, rows: [blankConnection] },
            labels: slotLabels(t("connEmpty")),
        },
        knowledge: {
            label: t("knowTitle"),
            slot: regionSlotOf(slot, (dashboard) => dashboard.knowledge.isFailed, knowledgeViewOf),
            placeholder: knowledgeViewOf(PENDING_DASHBOARD),
            labels: slotLabels(t("knowTitle")),
        },
    }
}
