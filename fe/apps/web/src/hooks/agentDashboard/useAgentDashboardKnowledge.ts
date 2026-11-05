"use client"

import { KNOWLEDGE_ROUTES } from "@/modules/routes"
import { maskPhones } from "@/modules/utils"
import { useTranslations } from "next-intl"
import type { AgentDashboardView } from "./agentDashboard.shared"

/** The open gaps of the knowledge region. */
interface KnowledgeGaps {
    label: string
    count: string | null
    openLabel: string
    openHref: string
    emptyMessage: string
    emptyDescription: string
    rows: {
        id: string
        title: string
        description: string
        asked: string
    }[]
}

/** The body of the knowledge region. */
export interface KnowledgeBody {
    summary: string
    openLabel: string
    openHref: string
    footer: string
    publicTitle: string
    publicDescription: string
    internalTitle: string
    internalDescription: string
    gaps: KnowledgeGaps | null
}

/** The knowledge region: the lens of the agent and, when the reader may see it and the module has none of its own, the open gaps. */
const knowledgeOf = (
    t: ReturnType<typeof useTranslations<"agentDashboard">>,
    dashboard: AgentDashboardView,
    hasOwnGaps: boolean,
    whenOf: (iso: string | null) => string,
): KnowledgeBody => {
    const isInternal = dashboard.knowledge.audience === "internal"
    const gaps = dashboard.knowledge.gaps
    const restricted = dashboard.knowledge.facts.restricted
    const counts = (kind: "public" | "internal") =>
        t("knowCounts", { docs: dashboard.knowledge.documents[kind], facts: dashboard.knowledge.facts[kind] })
    const documents = dashboard.knowledge.documents
    return {
        summary: isInternal
            ? t("knowSummaryInternal", { n: documents.public + documents.internal })
            : t("knowSummaryPublic", { n: documents.public }),
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
                          title: maskPhones(gap.question),
                          description: whenOf(gap.lastSeenAt),
                          asked: t("gapAsked", { n: gap.count }),
                      })),
                      emptyMessage: t("gapsEmpty"),
                      emptyDescription: t("gapsEmptyBody"),
                  }
                : null,
    }
}

/** Words the knowledge region of the dashboard: the view of one read, for the module that may bring its own gaps card. */
export const useAgentDashboardKnowledge = (
    hasOwnGaps: boolean,
    whenOf: (iso: string | null) => string,
): ((dashboard: AgentDashboardView) => KnowledgeBody) => {
    const t = useTranslations("agentDashboard")
    return (dashboard) => knowledgeOf(t, dashboard, hasOwnGaps, whenOf)
}
