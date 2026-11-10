"use client"

import { useTranslations } from "next-intl"
import { useCallback, useMemo } from "react"
import { useMutateSaveWorkingHoursSwr } from "@/hooks/swr"
import { defaultHours, parseHours, serialiseHours } from "@/modules/workingHours"
import type { WorkingHours } from "@/modules/workingHours"
import { useGraphQLWithToast } from "@/modules/toast"
import { useRefreshInstallation } from "./useRefreshInstallation"

/** The view `useWorkingHours` returns. */
export interface WorkingHoursView {
    /** The hours the installation holds (the default while it holds none). */
    readonly saved: WorkingHours
    /** Saves the hours on the installation; answers whether the back end took them (a failure was already toasted). */
    readonly save: (hours: WorkingHours) => Promise<boolean>
    readonly isSaving: boolean
}

/**
 * The weekly working hours of one agent: read from the text its settings hold (`settings.workingHours`, JSON of the ranges per day) and
 * saved through the `saveWorkingHours` mutation, then the installations are read again.
 */
export const useWorkingHours = (installationId: string, savedText: string | null): WorkingHoursView => {
    const t = useTranslations("agentGeneral")
    const runGraphQL = useGraphQLWithToast()
    const mutation = useMutateSaveWorkingHoursSwr()
    const refresh = useRefreshInstallation()
    const saved = useMemo(() => parseHours(savedText) ?? defaultHours(), [savedText])
    const save = useCallback(
        async (hours: WorkingHours): Promise<boolean> => {
            const done = await runGraphQL(() => mutation.trigger({ installationId, value: serialiseHours(hours) }), {
                successMessage: t("saved"),
            })
            await refresh()
            return done !== undefined
        },
        [installationId, mutation, refresh, runGraphQL, t],
    )
    return { saved, save, isSaving: mutation.isMutating }
}
