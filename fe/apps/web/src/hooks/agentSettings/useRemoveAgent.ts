"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateRemoveAgentSwr } from "@/hooks/swr"
import { navigation } from "@/modules/i18n"
import { AGENTS_ROUTE } from "@/modules/routes"
import { useGraphQLWithToast } from "@/modules/toast"
import { useRefreshInstallation } from "./useRefreshInstallation"

/** Removes an agent for good: it stops at once, its history stays. On success the person goes back to the agents with a toast; a failure was already toasted. */
export const useRemoveAgent = (installationId: string) => {
    const t = useTranslations("modulesCore")
    const router = navigation.useRouter()
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateRemoveAgentSwr()
    const refresh = useRefreshInstallation()
    const remove = useCallback(async (): Promise<void> => {
        const done = await runGraphQL(() => trigger({ installationId }), { successMessage: t("removed") })
        if (done === undefined) return
        await refresh()
        router.replace(AGENTS_ROUTE)
    }, [installationId, runGraphQL, trigger, refresh, router, t])
    return { remove, isRemoving: isMutating }
}
