"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateRemoveAgentSwr } from "@/hooks/swr"
import { navigation } from "@/modules/i18n"
import { useWorkspaceId } from "@/hooks/workspaces"
import { AGENTS_ROUTE, workspaceHref } from "@/modules/routes"
import { useGraphQLWithToast } from "@/modules/toast"
import { useRefreshInstallation } from "./useRefreshInstallation"

/** The view `useRemoveAgent` returns. */
export interface RemoveAgentView {
    remove: () => Promise<void>
    isRemoving: boolean
}

/** Removes an agent for good: it stops at once, its history stays. On success the person goes back to the agents with a toast; a failure was already toasted. */
export const useRemoveAgent = (installationId: string): RemoveAgentView => {
    const t = useTranslations("modulesCore")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateRemoveAgentSwr()
    const refresh = useRefreshInstallation()
    const remove = useCallback(async (): Promise<void> => {
        const done = await runGraphQL(() => trigger({ installationId }), { successMessage: t("removed") })
        if (done === undefined) return
        await refresh()
        router.replace(workspaceHref(workspaceId, AGENTS_ROUTE))
    }, [installationId, runGraphQL, trigger, refresh, router, t, workspaceId])
    return { remove, isRemoving: isMutating }
}
