"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateRemoveAgentTriggerSwr, useMutateSaveAgentTriggerSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import type { AgentWorkPreset, AgentWorkTriggerView } from "@/modules/types"
import { DEFAULT_TIME_ZONE, presetNeedsTime } from "@/modules/agentWork"

/** A new clock trigger as the form holds it. */
interface NewClockTrigger {
    readonly preset: AgentWorkPreset
    readonly atTime: string
}

/** The trigger commands of the Work tab. Each answers whether it worked; a failure was already toasted. */
export const useAgentWorkTriggers = (installationId: string, refresh: () => Promise<unknown>) => {
    const t = useTranslations("agentWork")
    const runGraphQL = useGraphQLWithToast()
    const saveTrigger = useMutateSaveAgentTriggerSwr()
    const removeTrigger = useMutateRemoveAgentTriggerSwr()

    const addClock = useCallback(
        async (clock: NewClockTrigger): Promise<boolean> => {
            const saved = await runGraphQL(
                () =>
                    saveTrigger.trigger({
                        installationId,
                        kind: "schedule",
                        preset: clock.preset,
                        timeZone: DEFAULT_TIME_ZONE,
                        enabled: true,
                        ...(presetNeedsTime(clock.preset) ? { atTime: clock.atTime } : {}),
                    }),
                { successMessage: t("saved") },
            )
            await refresh()
            return saved !== undefined
        },
        [installationId, runGraphQL, saveTrigger, refresh, t],
    )
    const switchTrigger = useCallback(
        async (trigger: AgentWorkTriggerView, enabled: boolean): Promise<boolean> => {
            const saved = await runGraphQL(
                () =>
                    saveTrigger.trigger({
                        installationId,
                        triggerId: trigger.id,
                        kind: trigger.kind,
                        enabled,
                        timeZone: trigger.timeZone,
                        ...(trigger.preset === null ? {} : { preset: trigger.preset }),
                        ...(trigger.atTime === "" ? {} : { atTime: trigger.atTime }),
                        ...(trigger.eventName === "" ? {} : { eventName: trigger.eventName }),
                        ...(trigger.probeKey === "" ? {} : { probeKey: trigger.probeKey }),
                    }),
                { successMessage: t("saved") },
            )
            await refresh()
            return saved !== undefined
        },
        [installationId, runGraphQL, saveTrigger, refresh, t],
    )
    const removeClock = useCallback(
        async (triggerId: string): Promise<boolean> => {
            const removed = await runGraphQL(() => removeTrigger.trigger({ installationId, triggerId }), {
                successMessage: t("saved"),
            })
            await refresh()
            return removed !== undefined
        },
        [installationId, runGraphQL, removeTrigger, refresh, t],
    )
    return { addClock, switchTrigger, removeClock, isSaving: saveTrigger.isMutating || removeTrigger.isMutating }
}
