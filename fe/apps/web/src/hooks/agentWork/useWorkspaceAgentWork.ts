"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMember } from "@/hooks/member"
import { slotOfSwr } from "@/hooks/slot"
import { useMutateSetWorkspaceAgentWorkSwr, useQueryWorkspaceAgentWorkSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import type { WorkspaceAgentWorkView } from "@/modules/types"
import { WORK_POLL_IDLE_MS } from "@/modules/agentWork"

/** The kill switch of the whole workspace with its counts: read by every member, set by the owner only. */
export const useWorkspaceAgentWork = () => {
    const t = useTranslations("agentWork")
    const member = useMember()
    const runGraphQL = useGraphQLWithToast()
    const read = useQueryWorkspaceAgentWorkSwr({ refreshInterval: WORK_POLL_IDLE_MS })
    const { trigger, isMutating } = useMutateSetWorkspaceAgentWorkSwr()
    const { data, mutate } = read
    const change = useCallback(
        async (enabled: boolean): Promise<boolean> => {
            const saved = await runGraphQL(() => trigger({ enabled }), { successMessage: t("saved") })
            await mutate()
            return saved !== undefined
        },
        [runGraphQL, trigger, mutate, t],
    )
    const view: WorkspaceAgentWorkView | undefined =
        data === undefined
            ? undefined
            : {
                  isOn: data.workEnabled,
                  canChange: member === null || member.role === "owner",
                  countsLabel: t("workspaceCounts", {
                      off: data.agentsOff,
                      pending: data.pendingWakes,
                      held: data.heldWakes,
                  }),
              }
    const slot = slotOfSwr<WorkspaceAgentWorkView>({ data: view, error: read.error, isLoading: read.isLoading })
    return { slot, change, isChanging: isMutating, reload: () => void mutate() }
}
