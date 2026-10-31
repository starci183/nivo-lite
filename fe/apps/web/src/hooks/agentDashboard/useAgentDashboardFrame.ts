"use client"

import { type ModuleKey, useModuleName } from "@/hooks/installations"
import { useSlotLabels } from "@/hooks/slot"
import { useWorkbenchBand, useWorkbenchWhy, useWorkbenchWhyKey } from "@/hooks/workbench"
import type { DataSlot, WorkbenchBandView } from "@/modules/types"
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
    const tw = useTranslations("workbench")
    const slotLabels = useSlotLabels()
    const moduleName = useModuleName(input.module)
    const { slot, reload } = useAgentDashboard(input.module, input.installationId ?? null)
    const regions = useAgentDashboardRegions(slot, input)

    const dashboard = slot.items
    const bandView = useWorkbenchBand({
        module: input.module,
        installationId: input.installationId,
        mode: dashboard?.agent?.mode ?? null,
        connections: (dashboard?.connections.items ?? []).map((connection) => ({
            id: connection.id,
            name: connection.name,
            isConnected: connection.status === "connected",
        })),
        needFacts: {
            connectedProviders: (dashboard?.connections.items ?? [])
                .filter((connection) => connection.status === "connected")
                .map((connection) => connection.provider),
            sources: {},
        },
        lastDoneAt: dashboard?.done.items[0]?.at ?? null,
    })
    const bandPlaceholder: WorkbenchBandView = {
        state: { label: "-", tone: "neutral", isEchoing: false },
        mode: null,
        version: null,
        lastActivity: "-",
        channels: [],
    }
    /** The band never fails: it shows what is known, and the name of the module stands in for nothing. */
    const band: DataSlot<WorkbenchBandView> =
        slot.isLoading === true ? { isLoading: true } : { items: bandView }
    const whyKey = useWorkbenchWhyKey()
    const why = useWorkbenchWhy()
    const waitingTotal = slot.items?.waiting.total ?? 0
    /** The label of a tab; the waiting tab carries the number of decisions waiting once there are any. */
    const tabLabel = (tab: FrameTab, waitingTab: string | undefined): string =>
        tab.id === waitingTab && waitingTotal > 0 ? `${tab.label} (${waitingTotal})` : tab.label
    return {
        band: { label: tw("bandLabel"), slot: band, placeholder: bandPlaceholder, labels: slotLabels(moduleName) },
        why: { workItemId: whyKey.workItemId, ...why },
        closeWhy: whyKey.close,
        regions,
        tabsLabel: t("tabsLabel"),
        tabLabel,
        reload,
    }
}
