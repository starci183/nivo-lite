"use client"

import { useQueryAgentWorkSwr } from "@/hooks/swr"
import { useAgentWorkItems } from "./useAgentWorkItems"
import { useAgentWorkTriggers } from "./useAgentWorkTriggers"

/** The commands of the Work tab (goals, triggers, tasks); the tab reads again after each one. */
export const useAgentWorkActions = (installationId: string) => {
    const { mutate } = useQueryAgentWorkSwr({ installationId })
    const items = useAgentWorkItems(installationId, mutate)
    const triggers = useAgentWorkTriggers(installationId, mutate)
    return { ...items, ...triggers, isSaving: items.isSaving || triggers.isSaving }
}
