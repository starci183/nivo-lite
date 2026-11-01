"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useInstallations } from "@/hooks/installations"
import { useMember } from "@/hooks/member"
import { slotOfSwr } from "@/hooks/slot"
import { useMutateSetAgentWorkSwr, useQueryAgentWorkSwr } from "@/hooks/swr"
import { agentLifecycleTone, isSetupPending } from "@/modules/installations"
import { useGraphQLWithToast } from "@/modules/toast"
import type { AgentWorkSwitchView } from "@/modules/types"

/**
 * The kill switch of one agent: read from the same answer as the Work tab, set by the owner only. Its status is the one state of the
 * agent (the lifecycle): a switch left on never reads as running for an agent that is not set up; off reads as paused.
 */
export const useAgentWorkSwitch = (installationId: string) => {
    const t = useTranslations("agentWork")
    const tAgent = useTranslations("modulesCore")
    const { slot: installations } = useInstallations()
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
    const lifecycle = installations.items?.find((installation) => installation.id === installationId)?.lifecycle ?? null
    const isStopped = !isOn && !isSetupPending(lifecycle)
    const statusLabelOf = (): string => {
        if (isStopped) return t("switchStatusOff")
        return lifecycle === null ? "" : tAgent(`lifecycle_${lifecycle}`)
    }
    const view: AgentWorkSwitchView | undefined =
        data === undefined
            ? undefined
            : {
                  isOn,
                  statusLabel: statusLabelOf(),
                  tone: isStopped ? "danger" : agentLifecycleTone(lifecycle ?? "notInstalled"),
                  canChange: member === null || member.role === "owner",
              }
    const slot = slotOfSwr<AgentWorkSwitchView>({ data: view, error: read.error, isLoading: read.isLoading })
    return { slot, change, isChanging: isMutating, reload: () => void mutate() }
}
