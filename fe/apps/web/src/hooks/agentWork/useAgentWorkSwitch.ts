"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMember } from "@/hooks/member"
import { slotOfSwr } from "@/hooks/slot"
import { useMutateSetAgentWorkSwr, useQueryAgentWorkSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import type { AgentWorkSwitchView } from "@/modules/types"

/** The kill switch of one agent: read from the same answer as the Work tab, set by the owner only. */
export const useAgentWorkSwitch = (installationId: string) => {
    const t = useTranslations("agentWork")
    const member = useMember()
    const runGraphQL = useGraphQLWithToast()
    const read = useQueryAgentWorkSwr({ installationId })
    const { trigger, isMutating } = useMutateSetAgentWorkSwr()
    const { data, mutate } = read
    const change = useCallback(
        async (enabled: boolean): Promise<boolean> => {
            const saved = await runGraphQL(() => trigger({ installationId, enabled }), { successMessage: t("saved") })
            await mutate()
            return saved !== undefined
        },
        [installationId, runGraphQL, trigger, mutate, t],
    )
    const isOn = data?.state.workEnabled ?? true
    const view: AgentWorkSwitchView | undefined =
        data === undefined
            ? undefined
            : {
                  isOn,
                  statusLabel: isOn ? t("switchStatusOn") : t("switchStatusOff"),
                  tone: isOn ? "success" : "danger",
                  canChange: member === null || member.role === "owner",
              }
    const slot = slotOfSwr<AgentWorkSwitchView>({ data: view, error: read.error, isLoading: read.isLoading })
    return { slot, change, isChanging: isMutating, reload: () => void mutate() }
}
