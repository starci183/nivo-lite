"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateSetModuleLiveSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { useRefreshInstallation } from "./useRefreshInstallation"

/** The view `useChooseLive` returns. */
export interface ChooseLiveView {
    choose: (live: boolean, keep?: "resumed" | "current") => Promise<boolean>
    isSaving: boolean
}

/**
 * Switches an agent live or paused. Answers whether it worked; a failure was already toasted, and a resume that would give a channel two
 * agents of one role says so in that toast. `keep` answers it: "resumed" keeps this agent on those channels, "current" keeps the other.
 */
export const useChooseLive = (installationId: string): ChooseLiveView => {
    const t = useTranslations("modulesCore")
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateSetModuleLiveSwr()
    const refresh = useRefreshInstallation()
    const choose = useCallback(
        async (live: boolean, keep?: "resumed" | "current"): Promise<boolean> => {
            const done = await runGraphQL(() => trigger({ installationId, live, keep }), {
                successMessage: t("saved"),
            })
            await refresh()
            return done !== undefined
        },
        [installationId, runGraphQL, trigger, refresh, t],
    )
    return { choose, isSaving: isMutating }
}
