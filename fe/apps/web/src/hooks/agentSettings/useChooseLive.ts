"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateSetModuleLiveSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { useRefreshInstallation } from "./useRefreshInstallation"

/** The view `useChooseLive` returns. */
export interface ChooseLiveView {
    choose: (live: boolean) => Promise<boolean>
    isSaving: boolean
}

/** Switches an agent live or paused. Answers whether it worked; a failure was already toasted. */
export const useChooseLive = (installationId: string): ChooseLiveView => {
    const t = useTranslations("modulesCore")
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateSetModuleLiveSwr()
    const refresh = useRefreshInstallation()
    const choose = useCallback(
        async (live: boolean): Promise<boolean> => {
            const done = await runGraphQL(() => trigger({ installationId, live }), { successMessage: t("saved") })
            await refresh()
            return done !== undefined
        },
        [installationId, runGraphQL, trigger, refresh, t],
    )
    return { choose, isSaving: isMutating }
}
