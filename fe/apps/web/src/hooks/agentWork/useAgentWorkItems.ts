"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateCloseAgentTaskSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"

/** The view `useAgentWorkItems` returns. */
export interface AgentWorkItemsView {
    closeTask: (taskId: string) => Promise<boolean>
    isSaving: boolean
}

/** The task commands of the Work tab. Each answers whether it worked; a failure was already toasted. */
export const useAgentWorkItems = (installationId: string, refresh: () => Promise<unknown>): AgentWorkItemsView => {
    const t = useTranslations("agentWork")
    const runGraphQL = useGraphQLWithToast()
    const closeTask = useMutateCloseAgentTaskSwr()

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
    return { closeTask: closeOneTask, isSaving: closeTask.isMutating }
}
