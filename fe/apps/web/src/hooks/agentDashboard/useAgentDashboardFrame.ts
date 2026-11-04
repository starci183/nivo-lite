"use client"

import type { ModuleKey } from "@/hooks/installations"
import { useWorkbenchWhy, useWorkbenchWhyKey } from "@/hooks/workbench"
import { useTranslations } from "next-intl"
import { useAgentDashboard } from "./useAgentDashboard"
import { useAgentDashboardRegions, type AgentDashboardRegionsView } from "./useAgentDashboardRegions"

/** One tab of the frame as the strip names it. */
export interface FrameTab {
    readonly id: string
    readonly label: string
}

/** What the frame hands the hook: the module, its instance and the pieces the module brings itself. */
interface AgentDashboardFrameInput {
    readonly module: ModuleKey
    readonly installationId: string | null
    /** The module brings its own gaps card: the built-in one is not offered. */
    readonly hasOwnGaps: boolean
    /** False while this workbench is replaced by its separate editor route. */
    readonly isActive?: boolean
}

/** The view `useAgentDashboardFrame` returns. */
export interface AgentDashboardFrameView {
    why: {
        view: null
        labels: {
            pathLabel: string
            factsLabel: string
            sourcesLabel: string
            approverLabel: string
            timeLabel: string
            openOnMap: string
            missingTitle: string
            missingBody: string
        }
        closeLabel: string
        openLabel: string
        paneLabel: string
        listLabel: string
        workItemId: string | null
    }
    closeWhy: () => void
    regions: AgentDashboardRegionsView
    tabsLabel: string
    tabLabel: (tab: FrameTab, waitingTab: string | undefined) => string
    reload: () => void
}

/** The words and figures of the shared anatomy of an agent workbench: the dashboard of the module read in the browser, worded for the frame. */
export const useAgentDashboardFrame = (input: AgentDashboardFrameInput): AgentDashboardFrameView => {
    const t = useTranslations("agentDashboard")
    const { slot, reload } = useAgentDashboard(input.module, input.installationId ?? null, input.isActive ?? true)
    const regions = useAgentDashboardRegions(slot, input)

    const whyKey = useWorkbenchWhyKey()
    const why = useWorkbenchWhy()
    const waitingTotal = ("items" in slot ? slot.items : undefined)?.waiting.total ?? 0
    /** The label of a tab; the waiting tab carries the number of decisions waiting once there are any. */
    const tabLabel = (tab: FrameTab, waitingTab: string | undefined): string =>
        tab.id === waitingTab && waitingTotal > 0 ? `${tab.label} (${waitingTotal})` : tab.label
    return {
        why: { workItemId: whyKey.workItemId, ...why },
        closeWhy: whyKey.close,
        regions,
        tabsLabel: t("tabsLabel"),
        tabLabel,
        reload,
    }
}
