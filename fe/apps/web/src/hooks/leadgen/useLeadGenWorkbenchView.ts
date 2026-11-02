"use client"
import { LEADGEN_TABS } from "@/modules/types"

import { useFormatter, useTranslations } from "next-intl"
import { useAgentDashboardFrame, useAgentWorkbenchTabs } from "@/hooks/agentDashboard"
import { handoffsViewOf, leadsViewOf, sourcesViewOf } from "@/hooks/leadgenView"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { LEADGEN_PENDING_METRICS, leadGenFiguresOf } from "./leadgen.shared"
import { useLeadGenComments } from "./useLeadGenComments"
import { useLeadGenWorkbench } from "./useLeadGenWorkbench"

type LeadGenTab = (typeof LEADGEN_TABS)[number]

/** Resolved route identity and the four tab labels supplied by the server page. */
interface LeadGenWorkbenchViewInput {
    readonly installationId: string | null
    readonly initialTab: string | null
    readonly tabs: Readonly<Record<LeadGenTab, string>>
}

/** Resolves one Lead Gen workbench world; lower views receive data and atomic commands only. */
export const useLeadGenWorkbenchView = (input: LeadGenWorkbenchViewInput) => {
    const t = useTranslations("workbenchLeadGen")
    const dashboard = useTranslations("agentDashboard")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const tabs = useAgentWorkbenchTabs({ ids: LEADGEN_TABS, initialTab: input.initialTab })
    const frame = useAgentDashboardFrame({
        module: "lead_gen",
        installationId: input.installationId,
        hasOwnGaps: false,
    })
    const workbench = useLeadGenWorkbench(input.installationId)
    const isCommentsActive = tabs.selected === "comments" && frame.why.workItemId === null
    const rows = "items" in workbench.slot ? workbench.slot.items.comments : []
    const comments = useLeadGenComments(rows, isCommentsActive)
    const panel = mapSlot(workbench.slot, (data) => ({
        leads: leadsViewOf(t, format, data.leads, data.leadsHidden),
        sources: sourcesViewOf(t, data.sources),
        handoffs: handoffsViewOf(t, format, data.handoffs),
        comments: comments.props,
    }))
    return {
        shape: frame.why.workItemId === null ? tabs.selected : ("explanation" as const),
        props: {
            why: frame.why,
            regions: frame.regions,
            tabsLabel: frame.tabsLabel,
            selectedTab: tabs.selected,
            tabs: LEADGEN_TABS.map((id) => ({ id, label: frame.tabLabel({ id, label: input.tabs[id] }, "comments") })),
            ribbon: {
                label: dashboard("ribbonAria"),
                slot: mapSlot(workbench.slot, (data) => leadGenFiguresOf(data.metrics, t)),
                placeholder: leadGenFiguresOf(LEADGEN_PENDING_METRICS, t),
                labels: slotLabels(t("loadFailedTitle")),
            },
            panel: {
                slot: panel,
                placeholder: {
                    leads: leadsViewOf(t, format, [], 0),
                    sources: sourcesViewOf(t, []),
                    handoffs: handoffsViewOf(t, format, []),
                    comments: comments.props,
                },
                labels: slotLabels(input.tabs[tabs.selected]),
            },
        },
        on: {
            selectTab: tabs.select,
            closeWhy: frame.closeWhy,
            retryDashboard: frame.reload,
            retry: workbench.retry,
            comments: comments.on,
        },
    }
}
