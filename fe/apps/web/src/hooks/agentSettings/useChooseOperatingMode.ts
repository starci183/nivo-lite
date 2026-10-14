"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateSetOperatingModeSwr } from "@/hooks/swr"
import type { OperatingMode } from "@/modules/installations"
import { useGraphQLWithToast } from "@/modules/toast"
import { useRefreshInstallation } from "./useRefreshInstallation"

/** Chooses how an agent runs (assist or autopilot). Answers whether it worked; a failure was already toasted. */
export const useChooseOperatingMode = (installationId: string) => {
    const t = useTranslations("modulesCore")
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateSetOperatingModeSwr()
    const refresh = useRefreshInstallation()
    const choose = useCallback(
        async (mode: OperatingMode): Promise<boolean> => {
            const done = await runGraphQL(() => trigger({ installationId, mode }), { successMessage: t("saved") })
            await refresh()
            return done !== undefined
        },
        [installationId, runGraphQL, trigger, refresh, t],
    )
    return { choose, isSaving: isMutating }
}
