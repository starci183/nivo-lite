"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateCloseAgentTaskSwr, useMutateSaveAgentGoalSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import type { AgentWorkGoalView } from "@/modules/types"

/** The goal and task commands of the Work tab. Each answers whether it worked; a failure was already toasted. */
export const useAgentWorkItems = (installationId: string, refresh: () => Promise<unknown>) => {
    const t = useTranslations("agentWork")
    const runGraphQL = useGraphQLWithToast()
    const saveGoal = useMutateSaveAgentGoalSwr()
    const closeTask = useMutateCloseAgentTaskSwr()

    const addGoal = useCallback(
        async (title: string): Promise<boolean> => {
            const saved = await runGraphQL(
                () => saveGoal.trigger({ installationId, title, detail: "", status: "active" }),
                { successMessage: t("saved") },
            )
            await refresh()
            return saved !== undefined
        },
        [installationId, runGraphQL, saveGoal, refresh, t],
    )
    const closeGoal = useCallback(
        async (goal: AgentWorkGoalView): Promise<boolean> => {
            const saved = await runGraphQL(
                () =>
                    saveGoal.trigger({
                        installationId,
                        goalId: goal.id,
                        title: goal.title,
                        detail: goal.detail,
                        status: "done",
                    }),
                { successMessage: t("saved") },
            )
            await refresh()
            return saved !== undefined
        },
        [installationId, runGraphQL, saveGoal, refresh, t],
    )
    const closeOneTask = useCallback(
        async (taskId: string): Promise<boolean> => {
            const closed = await runGraphQL(() => closeTask.trigger({ installationId, taskId }), {
                successMessage: t("saved"),
            })
            await refresh()
            return closed !== undefined
        },
        [installationId, runGraphQL, closeTask, refresh, t],
    )
    return { addGoal, closeGoal, closeTask: closeOneTask, isSaving: saveGoal.isMutating || closeTask.isMutating }
}
