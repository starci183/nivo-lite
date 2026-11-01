"use client"

import type { ModuleKey } from "@/hooks/installations"
import { useWorkbenchWhy, useWorkbenchWhyKey } from "@/hooks/workbench"
import { useTranslations } from "next-intl"
import { useAgentDashboard } from "./useAgentDashboard"
import { useAgentDashboardRegions } from "./useAgentDashboardRegions"

/** One tab of the frame as the strip names it. */
interface FrameTab {
    readonly id: string
    readonly label: string
}

/** What the frame hands the hook: the module, its instance and the pieces the module brings itself. */
interface AgentDashboardFrameInput {
    readonly module: ModuleKey
    readonly installationId: string | null
    /** The module brings its own gaps card: the built-in one is not offered. */
    readonly hasOwnGaps: boolean
}

/** The words and figures of the shared anatomy of an agent workbench: the dashboard of the module read in the browser, worded for the frame. */
export const useAgentDashboardFrame = (input: AgentDashboardFrameInput) => {
    const t = useTranslations("agentDashboard")
    const { slot, reload } = useAgentDashboard(input.module, input.installationId ?? null)
    const regions = useAgentDashboardRegions(slot, input)

    const whyKey = useWorkbenchWhyKey()
    const why = useWorkbenchWhy()
    const waitingTotal = slot.items?.waiting.total ?? 0
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
