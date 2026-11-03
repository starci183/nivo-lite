"use client"

import type { ModuleKey } from "@/hooks/installations"
import { useWorkbenchWhy, useWorkbenchWhyKey } from "@/hooks/workbench"
import { useTranslations } from "next-intl"
import { useAgentDashboard } from "./useAgentDashboard"
import { useAgentDashboardRegions } from "./useAgentDashboardRegions"
import type { DataSlot, SlotLabels } from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"

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
    regions: {
        waiting: {
            label: string
            slot: DataSlot<{
                count: string | null
                rows: {
                    id: string
                    title: string
                    description: string
                    href: string
                }[]
                openLabel: string
                more: string | null
                emptyMessage: string
                emptyDescription: string
            }>
            placeholder: {
                count: string
                rows: {
                    id: string
                    title: string
                    description: string
                    href: string
                }[]
                openLabel: string
                more: string | null
                emptyMessage: string
                emptyDescription: string
            }
            labels: SlotLabels
        }
        done: {
            label: string
            slot: DataSlot<{
                count: string
                logLabel: string
                logHref: string
                rows: {
                    id: string
                    title: string
                    description: string
                    href: string
                }[]
                emptyMessage: string
                emptyDescription: string
            }>
            placeholder: {
                rows: {
                    id: string
                    title: string
                    description: string
                    href: string
                }[]
                count: string
                logLabel: string
                logHref: string
                emptyMessage: string
                emptyDescription: string
            }
            labels: SlotLabels
        }
        connections: {
            label: string
            slot: DataSlot<{
                manageLabel: string
                manageHref: "/connections"
                rows: {
                    id: string
                    name: string
                    description: string
                    statusLabel: string
                    statusTone: BadgeTone
                    accessLabel: string
                }[]
                emptyMessage: string
                emptyDescription: string
            }>
            placeholder: {
                rows: {
                    name: string
                    statusLabel: string
                    statusTone: "neutral"
                    accessLabel: string
                    id: string
                    title: string
                    description: string
                    href: string
                }[]
                manageLabel: string
                manageHref: "/connections"
                emptyMessage: string
                emptyDescription: string
            }
            labels: SlotLabels
        }
        knowledge: {
            label: string
            slot: DataSlot<{
                openLabel: string
                openHref: string
                footer: string
                publicTitle: string
                publicDescription: string
                internalTitle: string
                internalDescription: string
                gaps: {
                    label: string
                    count: string | null
                    openLabel: string
                    openHref: string
                    rows: {
                        id: string
                        title: string
                        description: string
                        asked: string
                    }[]
                    emptyMessage: string
                    emptyDescription: string
                } | null
            }>
            placeholder: {
                openLabel: string
                openHref: string
                footer: string
                publicTitle: string
                publicDescription: string
                internalTitle: string
                internalDescription: string
                gaps: {
                    label: string
                    count: string | null
                    openLabel: string
                    openHref: string
                    rows: {
                        id: string
                        title: string
                        description: string
                        asked: string
                    }[]
                    emptyMessage: string
                    emptyDescription: string
                } | null
            }
            labels: SlotLabels
        }
    }
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
