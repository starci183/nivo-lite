"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateRenameInstallationAgentSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { useRefreshInstallation } from "./useRefreshInstallation"

/**
 * Saves the display name of an agent. An agent has one name for every type, instance or not: the one the header, Office, the chat and
 * the OpenClaw copy show. Answers whether it worked; a failure was already toasted with the server message.
 */
export const useSaveAgentName = (installationId: string) => {
    const t = useTranslations("modulesCore")
    const runGraphQL = useGraphQLWithToast()
    const renameAgent = useMutateRenameInstallationAgentSwr()
    const refresh = useRefreshInstallation()
    const save = useCallback(
        async (name: string): Promise<boolean> => {
            const done = await runGraphQL(() => renameAgent.trigger({ installationId, name }), {
                successMessage: t("saved"),
            })
            await refresh()
            return done !== undefined
        },
        [installationId, runGraphQL, renameAgent, refresh, t],
    )
    return { save, isSaving: renameAgent.isMutating }
}
