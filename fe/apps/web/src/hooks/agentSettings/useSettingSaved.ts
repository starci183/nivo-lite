"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useGraphQLWithToast } from "@/modules/toast"
import { useRefreshInstallation } from "./useRefreshInstallation"

/**
 * Runs one setting save of an installation: toasts "saved" or the server failure, refreshes the installation, and answers whether it
 * worked.
 */
export const useSettingSaved = (): ((run: () => Promise<unknown>) => Promise<boolean>) => {
    const t = useTranslations("modulesCore")
    const runGraphQL = useGraphQLWithToast()
    const refresh = useRefreshInstallation()
    return useCallback(
        async (run: () => Promise<unknown>): Promise<boolean> => {
            const done = await runGraphQL(run, { successMessage: t("saved") })
            await refresh()
            return done !== undefined
        },
        [runGraphQL, refresh, t],
    )
}
