"use client"

import { useAgentRoute, type ModuleKey } from "@/hooks/installations"
import { useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { useAgentKnowledge, type AgentKnowledgeData } from "@/hooks/agentKnowledge"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { AgentKnowledgeBase } from "./component"
import { knowledgeViewOf } from "./view"

/** What the route hands the tab: the workspace and the installed agent of the url. */
interface AgentKnowledgeProps {
    readonly workspaceId?: string | undefined
    readonly module?: ModuleKey | undefined
    readonly installationId?: string | undefined
}

/** The sources a page of the table holds. */
const PAGE_SIZE = 6

/** A read of the same shape as a ready one, so the cards keep their geometry while the agent is read. */
const PLACEHOLDER_DATA: AgentKnowledgeData = {
    agentId: "-",
    audience: "internal",
    installationId: null,
    module: "-",
    name: "-",
    waitingFacts: 1,
    layers: ["public", "internal", "restricted"].map((layer) => ({
        layer,
        isRead: true,
        documents: 1,
        approvedFacts: 0,
        totalFacts: 1,
    })),
    documents: [1, 2, 3].map((id) => ({
        id: String(id),
        title: "-",
        kind: "text",
        layer: "public",
        updatedAt: "2026-01-01T00:00:00.000Z",
        isRead: true,
        approvedFacts: 0,
        waitingFacts: 1,
    })),
    ownFacts: [{ id: "-", label: "-", value: "-", isApproved: false }],
}

/**
 * The Knowledge tab of an installed agent: what it reads of the Second Brain by layer (public, internal, only this agent), the documents
 * it reads and the facts that wait for the owner, read through the same view the agent answers by.
 */
export const AgentKnowledge = (props: AgentKnowledgeProps) => {
    const route = useAgentRoute(props)
    const t = useTranslations("agentKnowledge")
    const tabs = useTranslations("modulesCore")
    const format = useFormatter()
    const router = navigation.useRouter()
    const slotLabels = useSlotLabels()
    const [page, setPage] = useState(1)
    const data = useAgentKnowledge(route.module, route.installationId)
    const scope = { workspaceId: route.workspaceId }
    return (
        <AgentKnowledgeBase
            props={{
                slot: mapSlot(data.slot, (read) => knowledgeViewOf(t, format, scope, read)),
                placeholder: knowledgeViewOf(t, format, scope, PLACEHOLDER_DATA),
                slotLabels: slotLabels(t("empty")),
                paneLabel: tabs("tab_knowledge"),
                page,
                pageSize: PAGE_SIZE,
                pagination: {
                    label: t("pagesLabel"),
                    previous: t("pagePrevious"),
                    next: t("pageNext"),
                },
            }}
            on={{
                review: (href) => router.push(href),
                retry: data.reload,
                page: setPage,
                pageLabel: (number) => t("pageNumber", { page: number }),
                summary: (from, to, total) => t("pagesSummary", { from, to, total }),
            }}
        />
    )
}
