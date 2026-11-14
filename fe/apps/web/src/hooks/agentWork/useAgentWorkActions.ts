"use client"

import { useQueryAgentWorkSwr } from "@/hooks/swr"
import { useAgentWorkItems } from "./useAgentWorkItems"
import { useAgentWorkTriggers, type NewClockTrigger } from "./useAgentWorkTriggers"
import type { AgentWorkTriggerView, AgentWorkGoalView } from "@/modules/types"

/** The view `useAgentWorkActions` returns. */
export interface AgentWorkActionsView {
    isSaving: boolean
    addClock: (clock: NewClockTrigger) => Promise<boolean>
    switchTrigger: (trigger: AgentWorkTriggerView, enabled: boolean) => Promise<boolean>
    removeClock: (triggerId: string) => Promise<boolean>
    addGoal: (title: string) => Promise<boolean>
    closeGoal: (goal: AgentWorkGoalView) => Promise<boolean>
    closeTask: (taskId: string) => Promise<boolean>
}

/** The commands of the Work tab (goals, triggers, tasks); the tab reads again after each one. */
export const useAgentWorkActions = (installationId: string): AgentWorkActionsView => {
    const { mutate } = useQueryAgentWorkSwr({ installationId })
    const items = useAgentWorkItems(installationId, mutate)
    const triggers = useAgentWorkTriggers(installationId, mutate)
    return { ...items, ...triggers, isSaving: items.isSaving || triggers.isSaving }
}
